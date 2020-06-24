const path = require('path');
const webpack = require('webpack');
const merge = require('webpack-merge');
const common = require('./webpack.common.js');

module.exports = merge(common, {
  mode: 'development',
  devtool: 'cheap-module-source-map',

  devServer: {
    contentBase: [path.resolve('dist'), path.resolve('src/assets')],
    port: 9000,
    hot: true,
    historyApiFallback: {
      rewrites: [{ from: /./, to: '/404.html' }],
    },
  },

  plugins: [new webpack.HotModuleReplacementPlugin()],
});
