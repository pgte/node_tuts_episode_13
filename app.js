var express = require('express');
var multipart = require('multipart');
var fs = require('fs');

var app = express.createServer();

var MemStore = require('connect/middleware/session/memory');

app.configure(function() {
  app.use(express.logger());
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.static(__dirname + '/static'));
  app.use(express.cookieParser());
  app.use(express.session({store: MemStore({
    reapInterval: 60000 * 10
  }), secret:'foobar'
}));
});

app.configure('development', function () {
  app.use(express.errorHandler({
    dumpExceptions: true,
    showStack: true
  }));
});

app.configure('production', function () {
  app.use(express.errorHandler());
});

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

app.dynamicHelpers(
  {
    session: function(req, res) {
      return req.session;
    },
    
    flash: function(req, res) {
      return req.flash();
    }
  }
);

function requiresLogin(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/sessions/new?redir=' + req.url);
  }
};

app.get('/', function(req, res) {
  res.render('root');
});

/* Sessions */

var users = require('./users');

app.get('/sessions/new', function(req, res) {
  res.render('sessions/new', {locals: {
    redir: req.query.redir
  }});
});

app.post('/sessions', function(req, res) {
  users.authenticate(req.body.login, req.body.password, function(user) {
    if (user) {
      req.session.user = user;
      res.redirect(req.body.redir || '/');
    } else {
      req.flash('warn', 'Login failed');
      res.render('sessions/new', {locals: {redir: req.body.redir}});
    }
  });
});

app.get('/sessions/destroy', function(req, res) {
  delete req.session.user;
  res.redirect('/sessions/new');
});

var products = require('./products');
var photos   = require('./photos');

app.get('/products', requiresLogin, function(req, res) {
  res.render('products/index', {locals: {
    products: products.all
  }});
});

app.get('/products/new', requiresLogin, function(req, res) {
  res.render('products/new', {locals: {
    product: req.body && req.body.product || products.new()
  }});
});

app.post('/products', requiresLogin, function(req, res) {
  var id = products.insert(req.body.product);
  res.redirect('/products/' + id);
});

app.get('/products/:id', function(req, res) {
  var product = products.find(req.params.id);
  res.render('products/show', {locals: {
    product: product
  }});
});

app.get('/products/:id/edit', requiresLogin, function(req, res) {
  var product = products.find(req.params.id);
  photos.list(function(err, photo_list) {
    if (err) {
      throw err;
    }
    res.render('products/edit', {locals: {
      product: product,
      photos: photo_list
    }});
    
  });
});

app.put('/products/:id', requiresLogin, function(req, res) {
  var id = req.params.id;
  products.set(id, req.body.product);
  res.redirect('/products/'+id);
});

/* Photos */

app.get('/photos', function(req, res) {
  photos.list(function(err, photo_list) {
    res.render('photos/index', {locals: {
      photos: photo_list
    }})
  });
});

app.get('/photos/new', function(req, res) {
  res.render('photos/new');
});

app.post('/photos', function(req, res) {
  req.setEncoding('binary');
  
  var parser = multipart.parser();
  
  parser.headers = req.headers;
  var ws;
  
  parser.onPartBegin = function(part) {
    ws = fs.createWriteStream(__dirname + '/static/uploads/photos/' + part.filename);
    ws.on('error', function(err) {
      throw err;
    });
  };
  
  parser.onData = function(data) {
    ws.write(data, 'binary');
  };
  
  parser.onPartEnd = function() {
    ws.end();
    parser.close();
    res.redirect('/photos');
  };
  
  req.on('data', function(data) {
    parser.write(data);
  });
  
});

app.listen(4000);