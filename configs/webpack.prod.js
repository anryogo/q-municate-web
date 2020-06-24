const webpack = require('webpack');
const merge = require('webpack-merge');
const TerserJSPlugin = require('terser-webpack-plugin');
const OptimizeCSSAssetsPlugin = require('optimize-css-assets-webpack-plugin');
const ImageminPlugin = require('imagemin-webpack');
const common = require('./webpack.common.js');
const PACKAGE = require('../package.json');

const banner = `
    ${PACKAGE.name} - ${PACKAGE.description}

    @version ${PACKAGE.version}
    @homepage ${PACKAGE.homepage}
    @license ${PACKAGE.license}
`;

module.exports = merge(common, {
  mode: 'production',

  optimization: {
    minimizer: [
      new TerserJSPlugin(),
      new OptimizeCSSAssetsPlugin(),
      new ImageminPlugin({
        imageminOptions: {
          plugins: ['gifsicle', 'jpegtran', 'optipng', 'svgo'],
        },
      }),
    ],
  },

  plugins: [
    new webpack.BannerPlugin({
      exclude: /vendor/,
      banner,
    }),
  ],
});
