import * as tf from "@tensorflow/tfjs";

function get1dGaussianKernel(sigma: number, size: number) {
  // Generate a 1d gaussian distribution across a range
  const x = tf.range(Math.floor(-size / 2) + 1, Math.floor(size / 2) + 1);
  const pow = tf.pow(x, 2);
  const exp = tf.exp(pow.div(-2.0 * (sigma * sigma)));
  const div = exp.div<tf.Tensor1D>(tf.sum(exp));
  return div;
}

function get2dGaussianKernel(size: number, sigma: number) {
  // This default is to mimic opencv2.
  sigma = sigma || 0.3 * ((size - 1) * 0.5 - 1) + 0.8;

  const kerne1d = get1dGaussianKernel(sigma, size);
  return tf.outerProduct(kerne1d, kerne1d);
}

export function getGaussianKernel(size = 1, sigma: number) {
  return tf.tidy(() => {
    const kerne2d = get2dGaussianKernel(size, sigma);
    const kerne3d = tf.stack<tf.Tensor2D>([kerne2d, kerne2d, kerne2d]);
    kerne3d.dispose();
    return tf.reshape(kerne3d, [size, size, 3, 1]) as tf.Tensor4D;
  });
}

export function blur(
  image: tf.Tensor<tf.Rank.R3>,
  kernel: tf.Tensor<tf.Rank.R4>
) {
  return tf.tidy(() => {
    return tf.depthwiseConv2d(image, kernel, 1, "same");
  });
}
