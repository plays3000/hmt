// import * as tf from "@tensorflow/tfjs";

// export async function train(
//   model,
//   INPUTS_TENSOR,
//   OUTPUTS_TENSOR,
//   EPOCHS,
//   BATCHSIZE
// ) {
//   const results = await model.fit(INPUTS_TENSOR, OUTPUTS_TENSOR, {
//     shuffle: true,
//     validationSplit: 0.2,
//     batchSize: BATCHSIZE,
//     epochs: EPOCHS,
//     callbacks: {
//       onEpochEnd: async (EPOCHS, logs) => {
//         console.log(`  train-set loss : ${logs.loss.toFixed(4)}`);
//         console.log(`  train-set accuracy : ${logs.acc.toFixed(4)}`);
//       },
//     },
//   });

//   OUTPUTS_TENSOR.dispose();
//   INPUTS_TENSOR.dispose();
//   evaluate();
//   return results;
// }

// export function evaluate(x_test, y_test) {
//   //x_test : tf.tensor, y_test : tf.tensor
//   // const OFFSET = Math.floor((Math.random() * INPUTS.length));

//   const answer = tf.tidy(function () {
//     // let newInput = tf.tensor(INPUTS[OFFSET]).reshape([IMAGE_SIZE, IMAGE_SIZE, IMAGE_CHANNEL]).expandDims();
//     const output = model.predict(x_test);
//     return output.squeeze().argMax().arraySync();
//   });

//   const accuracyCount = tf.metrics.categoricalAccuracy(y_test, answer);
//   const accuracy = tf
//     .sum(accuracyCount)
//     .div(tf.scalar(x_test.shape[0]))
//     .dataSync()[0];
//   answer.dispose();
//   accuracyCount.dispose();

//   return accuracy;
// }
