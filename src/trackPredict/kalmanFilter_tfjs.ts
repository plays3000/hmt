import * as tf from '@tensorflow/tfjs';
import {getMatrixInverse} from '../util/linalg.js';

export class KalmanFilter {
  dt: number;
  stateVariance: number;
  measurementVariance: number;
  method: string;
  U! : number;
  errorCov! : number[][];
  state! : number[][];
  predictedState! : number[][];
  predictedErrorCov! : number[][];
  prediction! : number[];

  constructor(
    dt: number = 1,
    stateVariance: number = 1,
    measurementVariance: number = 1,
    method: string = "Velocity",
    detection: number[]
  ) {
    this.method = method;
    this.stateVariance = stateVariance;
    this.measurementVariance = measurementVariance;
    this.dt = dt;
    this.initModel(detection);
  }

  initModel(detection: number[]): void {
    if (this.method === "Acceleration") {
      this.U = 1;
    } else {
      this.U = 0;
    }

    // 오차 공분산 행렬 초기화
    this.errorCov = [
      [this.stateVariance,0,0,0,0,0,0,0],
      [0,this.stateVariance,0,0,0,0,0,0],
      [0,0,this.stateVariance,0,0,0,0,0],
      [0,0,0,this.stateVariance,0,0,0,0],
      [0,0,0,0,this.stateVariance,0,0,0],
      [0,0,0,0,0,this.stateVariance,0,0],
      [0,0,0,0,0,0,this.stateVariance,0],
      [0,0,0,0,0,0,0,this.stateVariance]
    ]

    // 상태 벡터 초기화 [x, vx, y, vy]
    this.state = [
            [detection[0]],  // x 위치
            [0.0],           // x 속도
            [detection[1]],  // y 위치
            [0.0],           // y 속도
            [detection[2]],  // w (폭)
            [0.0],           // w 변화율
            [detection[3]],  // h (높이)
            [0.0]            // h 변화율
        ]
        
  }

  predict() : void {
    const dt = this.dt;
    const A = tf.tensor2d(
      [
        [1, dt, 0,  0,  0,  0,  0,  0],
            [0, 1,  0,  0,  0,  0,  0,  0],
            [0, 0,  1, dt, 0,  0,  0,  0],
            [0, 0,  0, 1,  0,  0,  0,  0],
            [0, 0,  0, 0,  1, dt, 0,  0],
            [0, 0,  0, 0,  0, 1,  0,  0],
            [0, 0,  0, 0,  0, 0,  1, dt],
            [0, 0,  0, 0,  0, 0,  0, 1],
      ],
      [8, 8],
      'float32'
    );

    const B = tf.tensor2d(
      [
        [(dt ** 2) / 2],
        [dt],
        [(dt ** 2) / 2],
        [dt],
        [(dt ** 2) / 2],
        [dt],
        [(dt ** 2) / 2],
        [dt],
      ],
      [8, 1],
      'float32'
    );

    const Q : tf.Tensor2D = tf.mul(
      this.stateVariance,
      tf.tensor2d(
        [
            [(dt ** 4) / 4, (dt ** 3) / 2, 0,             0,             0,             0,             0,             0],
            [(dt ** 3) / 2, dt ** 2,       0,             0,             0,             0,             0,             0],
            [0,             0,             (dt ** 4) / 4, (dt ** 3) / 2, 0,             0,             0,             0],
            [0,             0,             (dt ** 3) / 2, dt ** 2,       0,             0,             0,             0],
            [0,             0,             0,             0,             (dt ** 4) / 4, (dt ** 3) / 2, 0,             0],
            [0,             0,             0,             0,             (dt ** 3) / 2, dt ** 2,       0,             0],
            [0,             0,             0,             0,             0,             0,             (dt ** 4) / 4, (dt ** 3) / 2],
            [0,             0,             0,             0,             0,             0,             (dt ** 3) / 2, dt ** 2],
        ],
        [4, 4],
        'float32'
      )
    );

    // predictedState = A * state + B * U
    tf.engine().startScope();
    const matMul : tf.Tensor2D = tf.matMul(A, this.state);
    const mul : tf.Tensor2D = tf.mul(B, this.U);
    const add : tf.Tensor2D = tf.add(matMul, mul);
    const predictedStateArr : number[][] = add.arraySync();
    tf.engine().endScope();
    this.predictedState = predictedStateArr;

    // predictedErrorCov = A * errorCov * A' + Q  => 8x8
    tf.engine().startScope();
    const matMul1 : tf.Tensor2D = tf.matMul(A, this.errorCov);
    const matMul2 : tf.Tensor2D = tf.matMul(matMul1, A.transpose());
    const add2 : tf.Tensor2D = tf.add(matMul2, Q);
    const predictedErrorCovArr : number[][] = add2.arraySync();
    tf.engine().endScope();
    this.predictedErrorCov = predictedErrorCovArr;

    // this.predictedErrorCov = tf.add(tf.matMul(tf.matMul(A, this.errorCov), tf.transpose(A)),Q);

    // 예측된 위치 추출
    const x1 = Number(this.predictedState[0][0]);
    const y1 = Number(this.predictedState[2][0]);
    const x2 = Number(this.predictedState[4][0]);
    const y2 = Number(this.predictedState[6][0]);

    // 메모리 해제
    A.dispose();
    B.dispose();
    Q.dispose();

    this.prediction = [x1, y1, x2, y2];
  }

    correct(currentMeasurement: number[]): void {
        const H = tf.tensor2d(
        [
            [1, 0, 0, 0, 0, 0, 0, 0],  // x 위치
            [0, 0, 1, 0, 0, 0, 0, 0],  // y 위치
            [0, 0, 0, 0, 1, 0, 0, 0],  // w (폭)
            [0, 0, 0, 0, 0, 0, 1, 0],  // h (높이)
        ],
        [4, 8],
        'float32'
        );

        const z = tf.tensor2d([
            [currentMeasurement[0]],  // x 위치
            [currentMeasurement[1]],  // y 위치
            [currentMeasurement[2] - currentMeasurement[0]],  // w (너비)
            [currentMeasurement[3] - currentMeasurement[1]]   // h (높이)
            ],
            [4,1],
            'float32'
        )

        const K = tf.tidy(()=>{
            const R = tf.mul(this.measurementVariance, tf.eye(4));
            const S : tf.Tensor2D= tf.add(tf.matMul(tf.matMul(H, this.predictedErrorCov), H.transpose()), R);
            const sInv = getMatrixInverse(S);
            const K : tf.Tensor2D = tf.matMul(tf.matMul(this.predictedErrorCov, tf.transpose(H)),sInv);

            return K;
        })
        
        // y = z - (H @ this.predicted_state)
        const y = tf.sub(z, tf.matMul(H, this.predictedState));
        tf.engine().startScope();
        const matMul : tf.Tensor2D = tf.matMul(K, y);
        const add : tf.Tensor2D = tf.add(this.predictedState,matMul);
        const stateArr : number[][] = add.arraySync();
        tf.engine().endScope();
        this.state = stateArr;
        const I = tf.eye(stateArr.length);

        // this.errorCov = ((I - (K @ self.H)) @ self.predicted_error_cov)
        tf.engine().startScope();
        const K2selfH : tf.Tensor2D= tf.sub(I,tf.matMul(K, H));
        const predictedErrorCov : tf.Tensor2D = tf.matMul(K2selfH ,this.predictedErrorCov);
        const errorCovArr : number[][] = predictedErrorCov.arraySync();
        tf.engine().endScope();
        this.predictedErrorCov = errorCovArr;

        // 메모리 해제
        K.dispose();
        H.dispose();
        y.dispose();
        I.dispose();
    }
    
}
