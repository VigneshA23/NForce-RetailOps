import postcssPresetEnv from 'postcss-preset-env';

export default {
  plugins: [
    postcssPresetEnv({
      features: { 'custom-media-queries': true },
    }),
  ],
};
