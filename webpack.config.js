const path = require('path');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');

module.exports = {
  entry: {
    // 配置多个入口文件
    wasm_performance_demonstration: './src/wasm-performance-demonstration.js',
  },
  output: {
    filename: '[name].bundle.js', // 输出的捆绑文件名
    path: path.resolve(__dirname, 'static', 'js', 'dist'), // 输出目录
  },
  module: {
    rules: [
      // 使用 Babel 加载器来处理 JavaScript 文件
      {
        test: /\.js$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
        },
      },
      // 使用 style-loader 和 css-loader 处理 CSS 文件
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader'],
      },
      // 以 .worker.js 结尾的文件将被 worker-loader 加载
      {
        test: /\.worker\.js$/,
        use: { 
          loader: 'worker-loader',
        }
      },
      // 使用ts-loader处理TypeScript文件,当它遇到.ts或.tsx文件时，使用ts-loader来处理它们
      {
        test: /\.tsx?$/,
        use: 'ts-loader',
        exclude: /node_modules/
      }
    ],
  },
  plugins: [
    new CleanWebpackPlugin(), // 默认清理 dist 目录
  ],
};
