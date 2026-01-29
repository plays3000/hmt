// import * as tf from "@tensorflow/tfjs";

// export function loadData(
//   dataUrl: string,
//   batchSize: number,
//   numOfClasses: number
// ) {
//   // normalize data values between 0-1
//   const normalize = ({ xs, ys }: { xs: number[]; ys: any }) => {
//     return {
//       xs: Object.values(xs).map((x) => x / 255),
//       ys: ys.label,
//     };
//   };

//   // transform input array (xs) to 3D tensor
//   // binarize output label (ys)
//   const transform = ({
//     xs,
//     ys,
//     imageWidth,
//     imageHeight,
//     imageChannels,
//   }: {
//     xs: number[];
//     ys: any;
//     imageWidth: number;
//     imageHeight: number;
//     imageChannels: number;
//   }) => {
//     // array of zeros
//     const zeros = new Array(numOfClasses).fill(0);

//     return {
//       xs: tf.tensor(xs, [imageWidth, imageHeight, imageChannels]),
//       ys: tf.tensor1d(
//         zeros.map((z, i) => {
//           return i === ys ? 1 : 0;
//         })
//       ),
//     };
//   };

//   // load, normalize, transform, batch
//   return tf.data
//     .csv(dataUrl, { columnConfigs: { label: { isLabel: true } } })
//     .map(normalize as any)
//     .filter((f) => f.ys < numOfClasses)
//     .map(transform as any)
//     .batch(batchSize);
// }
