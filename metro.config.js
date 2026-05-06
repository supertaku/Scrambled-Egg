const { getDefaultConfig } = require("expo/metro-config");

const config = getDefaultConfig(__dirname);

config.resolver.blockList =
  /(?:node_modules[\\/].*[\\/]android[\\/](?:build|\.cxx)[\\/].*|android[\\/](?:\.gradle|.*[\\/](?:build|\.cxx))[\\/].*)/;

module.exports = config;
