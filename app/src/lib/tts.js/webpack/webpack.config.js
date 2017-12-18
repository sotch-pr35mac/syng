var webpack = require('webpack');
var path = require('path');
var ExtractTextPlugin = require("extract-text-webpack-plugin");
var HtmlWebpackPlugin = require('html-webpack-plugin');
var uglifyJsPlugin = webpack.optimize.UglifyJsPlugin;
var CommonsChunkPlugin = webpack.optimize.CommonsChunkPlugin;
var routes = require('./route');

var config = {
  context: path.join(__dirname, '..', '/src'),
  entry: {
  },
  output: {
      path: path.join(__dirname, '..', '/tts.js/'),
      filename: '[name].min.js',
  },
  plugins: [
      new webpack.DefinePlugin({
          __DEV__: JSON.stringify(JSON.parse(process.env.BUILD_DEV || 'true')), // judge if dev environment.
          __PRERELEASE__: JSON.stringify(JSON.parse(process.env.BUILD_PRERELEASE || 'false')) // judge if secret environment.
      }),
      new uglifyJsPlugin({
        compress: {
          warnings: false
        }
      }),
      new webpack.optimize.MinChunkSizePlugin({minChunkSize: 20000}),
      new webpack.optimize.OccurenceOrderPlugin(false),
      new webpack.optimize.AggressiveMergingPlugin({
            minSizeReduce: 1.5,
            moveToParents: true
      }),
      new webpack.optimize.DedupePlugin(),
      new ExtractTextPlugin("[name].[hash].css"),
  ],
  module: {
      loaders: [
        {
          test: /\.(jsx|js)?$/,
          exclude: /node_modules/,
          loader: "babel",
          query: {
            presets: ['es2015']
          }
         },
         {
           test: /\.css$/,
           loader: ExtractTextPlugin.extract('style-loader', 'css-loader!autoprefixer?{browsers:["last 2 version", "> 1%"]}')
         },
         {
           test: /\.scss$/,
           loader: ExtractTextPlugin.extract('style-loader', 'css-loader!autoprefixer?{browsers:["last 2 version", "> 1%"]}!sass')
         },
         {
           test: /\.(jpe?g|png|gif)$/i,
           loader: 'url?limit=10000!img?progressive=true'
         },
         {
            test: /\.(eot|woff|ttf|svg)$/,
            loader: 'url?limit=10000'
          }
      ]
  },
  resolve: {
    // 設定後只需要寫 require('file') 而不用寫成 require('file.jsx')
    extensions: ['', '.js', '.json', '.jsx']
  }
};

for (var i = 0; i < routes.length; i++) {
  var route = routes[i];
  config.entry[route.name] = route.entry;
  config.plugins.push(new HtmlWebpackPlugin({
    template: route.plugins.template || './../templates/index.html',
    filename: route.plugins.filename || 'index.html',
    chunks: [route.name],
    inject: 'body',
    hash: true
  }));
}

module.exports = config;
