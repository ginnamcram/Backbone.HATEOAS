const path = require('path');

module.exports = {
  entry: './src/index.js',
  output: {
    filename: 'hate2love.js',
    path: path.resolve(__dirname, 'dist')
  }
};