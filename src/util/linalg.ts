import * as tf from '@tensorflow/tfjs';

function transposeMatrix(m : number[][]){
    const trans_m = [];
    for (let j = 0; j < m[0].length; j++){
        const row = [];
        for (let i = 0; i < m.length; i++){
            row.push(m[i][j]);
        }
        trans_m.push(row);
    }
    return trans_m;
}

function getMatrixMinor(m : number[][], i: number,j: number){
    const m_j = [];
    const new_m = []
    for (let x = 0; x < m.length; x++){
        const row = m[x].map((k, idx)=>{if(idx != j){return k}});
        m_j.push(row);
    }
    for (let x = 0; x < m.length; x++){
        if (x != i){
            new_m.push(m[x]);
        }
    }

    return new_m;

}

function getMatrixDeternminant(m : number[][]){
    if (m.length == 2){      
        return (m[0][0] * m[1][1]) - (m[0][1] * m[1][0]);
    }

    let determinent = 0;
    for (let c = 0; c < m.length; c++){
        determinent += ((-1)**c)*m[0][c]* getMatrixDeternminant(getMatrixMinor(m, 0, c))
    } 
    return determinent;
}

export function getMatrixInverse(tensor_m : tf.Tensor2D){
    const m = tensor_m.arraySync();
    const determinant = getMatrixDeternminant(m);

    if (m.length == 2){
        return [[m[1][1]/determinant, -1*m[0][1]/determinant],
                [-1*m[1][0]/determinant, m[0][0]/determinant]]
    }

    // find matrix of cofactors
    let cofactors = [];
    for (let r = 0; r < m.length; r++){
        const cofactorRow = [];
        for (let c = 0; c < m.length; c++){
            const minor = getMatrixMinor(m, r, c);
            cofactorRow.push((-1)**(r+c)) * getMatrixDeternminant(minor);
        }
        cofactors.push(cofactorRow);
    }
    cofactors = transposeMatrix(cofactors);
    for (let r = 0; r < cofactors.length; r++){
        for (let c = 0; c < cofactors.length; c++){
            cofactors[r][c] = cofactors[r][c] / determinant;
        }
    }
    return tf.tensor(cofactors);
}