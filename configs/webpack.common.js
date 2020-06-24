const path = require('path');
const autoprefixer = require('autoprefixer');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const HtmlWebpackPlugin = require('html-webpack-plugin');

const basePath = path.resolve('src/app');
const assetsPath = path.resolve('src/assets');
const settingsPath = path.resolve('settings');
const distPath = path.resolve('dist');

module.exports = {
  entry: `${basePath}/scripts/main.js`,

  output: {
    filename: '[name].[hash].js',
    path: distPath,
  },

  optimization: {
    splitChunks: {
      cacheGroups: {
        vendor: {
          test: /(node_modules|vendor)/,
          chunks: 'initial',
          name: 'vendor',
        },
      },
    },
  },

  resolve: {
    modules: [
      `${basePath}/vendor`,
      'node_modules',
    ],
    alias: {
      // libs
      minEmoji: 'emoji/js/minEmoji',
      initTelInput: 'intl-tel-input/js/intlTelInput.min',
      intlTelInputUtils: 'intl-tel-input/js/utils',
      progressbar: 'progressbar/progressbar.min',

      // application
      config: `${settingsPath}/settings`,
      models: `${basePath}/scripts/models`,
      views: `${basePath}/scripts/views`,
      images: `${assetsPath}/images`,
      audio: `${assetsPath}/audio`,
    },
  },

  module: {
    rules: [
      {
        test: /minEmoji/,
        use: {
          loader: 'exports-loader',
          options: {
            type: 'commonjs',
            exports: 'single minEmoji',
          },
        },
      },
      {
        test: /progressbar/,
        use: {
          loader: 'exports-loader',
          options: {
            type: 'commonjs',
            exports: 'single ProgressBar',
          },
        },
      },
      {
        test: /\.js$/,
        exclude: /(node_modules|vendor|workers)/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
          },
        },
      },
      {
        test: /\.scss$/,
        exclude: /(node_modules|vendor)/,
        use: [
          MiniCssExtractPlugin.loader,
          { loader: 'css-loader', options: { sourceMap: true } },
          {
            loader: 'postcss-loader',
            options: {
              ident: 'postcss',
              plugins: [autoprefixer],
              sourceMap: true,
            },
          },
          { loader: 'sass-loader', options: { sourceMap: true } },
        ],
      },
      {
        test: /\.css$/,
        use: [
          MiniCssExtractPlugin.loader,
          'css-loader',
        ],
      },
      {
        test: /\.(png|jpe?g|gif|svg)$/,
        use: {
          loader: 'url-loader',
          options: {
            name: '[name].[hash].[ext]',
            outputPath: 'images',
            limit: 8192,
          },
        },
      },
      {
        test: /\.(mp3|ogg)$/,
        use: {
          loader: 'file-loader',
          options: {
            name: '[name].[hash].[ext]',
            outputPath: 'audio',
          },
        },
      },
      {
        test: /\.html$/,
        use: 'html-loader',
      },
    ],
  },

  plugins: [
    new MiniCssExtractPlugin({
      filename: '[name].[hash].css',
    }),
    new HtmlWebpackPlugin({
      template: `${basePath}/index.html`,
      minify: false,
    }),
    new HtmlWebpackPlugin({
      filename: '404.html',
      template: `${basePath}/404.html`,
      minify: false,
      excludeChunks: [
        'main',
        'vendor',
      ],
    }),
  ],
};
