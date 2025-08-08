const express = require('express');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// CÁC HÀM THUẬT TOÁN ĐƯỢC CUNG CẤP TỪ USER - VER 1
// =========================================================================
let modelPredictionsV1 = {};

function detectStreakAndBreakV1(history) {
    if (!history || history.length === 0) {
        return { streak: 0, currentResult: null, breakProb: 0 };
    }
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++;
        else break;
    }
    const last15Results = history.slice(-15).map(item => item.result);
    if (!last15Results.length) {
        return { streak, currentResult, breakProb: 0 };
    }
    const switches = last15Results.slice(1).reduce((count, result, index) => {
        return count + (result !== last15Results[index] ? 1 : 0);
    }, 0);
    const taiCount = last15Results.filter(result => result === 'Tài').length;
    const xiuCount = last15Results.filter(result => result === 'Xỉu').length;
    const imbalance = Math.abs(taiCount - xiuCount) / last15Results.length;
    let breakProb = 0;
    if (streak >= 8) {
        breakProb = Math.min(0.6 + switches / 15 + imbalance * 0.15, 0.9);
    } else if (streak >= 5) {
        breakProb = Math.min(0.35 + switches / 10 + imbalance * 0.25, 0.85);
    } else if (streak >= 3 && switches >= 7) {
        breakProb = 0.3;
    }
    return { streak, currentResult, breakProb };
}

function evaluateModelPerformanceV1(history, modelName, lookback = 10) {
    if (!modelPredictionsV1[modelName] || history.length < 2) return 1;
    lookback = Math.min(lookback, history.length - 1);
    let correctPredictions = 0;
    for (let i = 0; i < lookback; i++) {
        const sessionId = history[history.length - (i + 2)].session;
        const prediction = modelPredictionsV1[modelName][sessionId] || 0;
        const actualResult = history[history.length - (i + 1)].result;
        if ((prediction === 1 && actualResult === 'Tài') || (prediction === 2 && actualResult === 'Xỉu')) {
            correctPredictions++;
        }
    }
    const performanceRatio = lookback > 0 ? 1 + (correctPredictions - lookback / 2) / (lookback / 2) : 1;
    return Math.max(0.5, Math.min(1.5, performanceRatio));
}

function smartBridgeBreakV1(history) {
    if (!history || history.length < 3) {
        return { prediction: 0, breakProb: 0, reason: 'Không đủ dữ liệu để bẻ cầu' };
    }
    const { streak, currentResult, breakProb } = detectStreakAndBreakV1(history);
    const last20Results = history.slice(-20).map(item => item.result);
    const last20Scores = history.slice(-20).map(item => item.score || 0);
    let finalBreakProb = breakProb;
    let reason = '';
    const avgScore = last20Scores.reduce((sum, score) => sum + score, 0) / (last20Scores.length || 1);
    const scoreDeviation = last20Scores.reduce((sum, score) => sum + Math.abs(score - avgScore), 0) / (last20Scores.length || 1);
    const last5Results = last20Results.slice(-5);
    const patternCounts = {};
    for (let i = 0; i <= last20Results.length - 3; i++) {
        const pattern = last20Results.slice(i, i + 3).join(',');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    const hasRepeatingPattern = mostCommonPattern && mostCommonPattern[1] >= 3;
    if (streak >= 6) {
        finalBreakProb = Math.min(finalBreakProb + 0.15, 0.9);
        reason = `[Bẻ Cầu] Chuỗi ${streak} ${currentResult} dài, khả năng bẻ cầu cao`;
    } else if (streak >= 4 && scoreDeviation > 3) {
        finalBreakProb = Math.min(finalBreakProb + 0.1, 0.85);
        reason = `[Bẻ Cầu] Biến động điểm số lớn (${scoreDeviation.toFixed(1)}), khả năng bẻ cầu tăng`;
    } else if (hasRepeatingPattern && last5Results.every(result => result === currentResult)) {
        finalBreakProb = Math.min(finalBreakProb + 0.05, 0.8);
        reason = `[Bẻ Cầu] Phát hiện mẫu lặp ${mostCommonPattern[0]}, có khả năng bẻ cầu`;
    } else {
        finalBreakProb = Math.max(finalBreakProb - 0.15, 0.15);
        reason = '[Bẻ Cầu] Không phát hiện mẫu bẻ cầu mạnh, tiếp tục theo cầu';
    }
    let prediction = finalBreakProb > 0.65 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    return { prediction, breakProb: finalBreakProb, reason };
}

function trendAndProbV1(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreakV1(history);
    if (streak >= 5) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last15Results = history.slice(-15).map(item => item.result);
    if (!last15Results.length) return 0;
    const weightedResults = last15Results.map((result, index) => Math.pow(1.2, index));
    const taiWeight = weightedResults.reduce((sum, weight, i) => sum + (last15Results[i] === 'Tài' ? weight : 0), 0);
    const xiuWeight = weightedResults.reduce((sum, weight, i) => sum + (last15Results[i] === 'Xỉu' ? weight : 0), 0);
    const totalWeight = taiWeight + xiuWeight;
    const last10Results = last15Results.slice(-10);
    const patterns = [];
    if (last10Results.length >= 4) {
        for (let i = 0; i <= last10Results.length - 4; i++) {
            patterns.push(last10Results.slice(i, i + 4).join(','));
        }
    }
    const patternCounts = patterns.reduce((counts, pattern) => {
        counts[pattern] = (counts[pattern] || 0) + 1;
        return counts;
    }, {});
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonPattern && mostCommonPattern[1] >= 3) {
        const patternParts = mostCommonPattern[0].split(',');
        return patternParts[patternParts.length - 1] !== last10Results[last10Results.length - 1] ? 1 : 2;
    }
    if (totalWeight > 0 && Math.abs(taiWeight - xiuWeight) / totalWeight >= 0.25) {
        return taiWeight > xiuWeight ? 2 : 1;
    }
    return last15Results[last15Results.length - 1] === 'Xỉu' ? 1 : 2;
}

function shortPatternV1(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreakV1(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last8Results = history.slice(-8).map(item => item.result);
    if (!last8Results.length) return 0;
    const patterns = [];
    if (last8Results.length >= 3) {
        for (let i = 0; i <= last8Results.length - 3; i++) {
            patterns.push(last8Results.slice(i, i + 3).join(','));
        }
    }
    const patternCounts = patterns.reduce((counts, pattern) => {
        counts[pattern] = (counts[pattern] || 0) + 1;
        return counts;
    }, {});
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommonPattern && mostCommonPattern[1] >= 2) {
        const patternParts = mostCommonPattern[0].split(',');
        return patternParts[patternParts.length - 1] !== last8Results[last8Results.length - 1] ? 1 : 2;
    }
    return last8Results[last8Results.length - 1] === 'Xỉu' ? 1 : 2;
}

function meanDeviationV1(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreakV1(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last12Results = history.slice(-12).map(item => item.result);
    if (!last12Results.length) return 0;
    const taiCount = last12Results.filter(result => result === 'Tài').length;
    const xiuCount = last12Results.length - taiCount;
    const imbalance = Math.abs(taiCount - xiuCount) / last12Results.length;
    if (imbalance < 0.35) {
        return last12Results[last12Results.length - 1] === 'Xỉu' ? 1 : 2;
    }
    return xiuCount > taiCount ? 1 : 2;
}

function recentSwitchV1(history) {
    if (!history || history.length < 3) return 0;
    const { streak, currentResult, breakProb } = detectStreakAndBreakV1(history);
    if (streak >= 4) {
        if (breakProb > 0.75) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last10Results = history.slice(-10).map(item => item.result);
    if (!last10Results.length) return 0;
    const switches = last10Results.slice(1).reduce((count, result, index) => {
        return count + (result !== last10Results[index] ? 1 : 0);
    }, 0);
    return switches >= 6 ? (last10Results[last10Results.length - 1] === 'Xỉu' ? 1 : 2) : (last10Results[last10Results.length - 1] === 'Xỉu' ? 1 : 2);
}

function isBadPatternV1(history) {
    if (!history || history.length < 3) return false;
    const last15Results = history.slice(-15).map(item => item.result);
    if (!last15Results.length) return false;
    const switches = last15Results.slice(1).reduce((count, result, index) => {
        return count + (result !== last15Results[index] ? 1 : 0);
    }, 0);
    const { streak } = detectStreakAndBreakV1(history);
    return switches >= 9 || streak >= 10;
}

function aiHtddLogicV1(history) {
    if (!history || history.length < 3) {
        const randomPred = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomPred, reason: '[AI] Không đủ lịch sử, dự đoán ngẫu nhiên', source: 'AI HTDD' };
    }
    const last5Results = history.slice(-5).map(item => item.result);
    const last5Scores = history.slice(-5).map(item => item.score || 0);
    const taiCount = last5Results.filter(result => result === 'Tài').length;
    const xiuCount = last5Results.filter(result => result === 'Xỉu').length;
    if (history.length >= 3) {
        const last3Results = history.slice(-3).map(item => item.result);
        if (last3Results.join(',') === 'Tài,Xỉu,Tài') {
            return { prediction: 'Xỉu', reason: '[AI] Phát hiện mẫu 1T1X → nên đánh Xỉu', source: 'AI HTDD' };
        } else if (last3Results.join(',') === 'Xỉu,Tài,Xỉu') {
            return { prediction: 'Tài', reason: '[AI] Phát hiện mẫu 1X1T → nên đánh Tài', source: 'AI HTDD' };
        }
    }
    if (history.length >= 4) {
        const last4Results = history.slice(-4).map(item => item.result);
        if (last4Results.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
            return { prediction: 'Tài', reason: '[AI] Phát hiện mẫu 2T2X → nên đánh Tài', source: 'AI HTDD' };
        } else if (last4Results.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
            return { prediction: 'Xỉu', reason: '[AI] Phát hiện mẫu 2X2T → nên đánh Xỉu', source: 'AI HTDD' };
        }
    }
    if (history.length >= 9 && history.slice(-6).every(item => item.result === 'Tài')) {
        return { prediction: 'Xỉu', reason: '[AI] Chuỗi Tài quá dài (6 lần) → dự đoán Xỉu', source: 'AI HTDD' };
    } else if (history.length >= 9 && history.slice(-6).every(item => item.result === 'Xỉu')) {
        return { prediction: 'Tài', reason: '[AI] Chuỗi Xỉu quá dài (6 lần) → dự đoán Tài', source: 'AI HTDD' };
    }
    const avgScore = last5Scores.reduce((sum, score) => sum + score, 0) / (last5Scores.length || 1);
    if (avgScore > 10) {
        return { prediction: 'Tài', reason: `[AI] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'AI HTDD' };
    } else if (avgScore < 8) {
        return { prediction: 'Xỉu', reason: `[AI] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'AI HTDD' };
    }
    if (taiCount > xiuCount + 1) {
        return { prediction: 'Xỉu', reason: `[AI] Tài chiếm đa số (${taiCount}/${last5Results.length}) → dự đoán Xỉu`, source: 'AI HTDD' };
    } else if (xiuCount > taiCount + 1) {
        return { prediction: 'Tài', reason: `[AI] Xỉu chiếm đa số (${xiuCount}/${last5Results.length}) → dự đoán Tài`, source: 'AI HTDD' };
    } else {
        const totalTai = history.filter(item => item.result === 'Tài').length;
        const totalXiu = history.filter(item => item.result === 'Xỉu').length;
        if (totalTai > totalXiu + 2) {
            return { prediction: 'Xỉu', reason: '[AI] Tổng thể Tài nhiều hơn → dự đoán Xỉu', source: 'AI HTDD' };
        } else if (totalXiu > totalTai + 2) {
            return { prediction: 'Tài', reason: '[AI] Tổng thể Xỉu nhiều hơn → dự đoán Tài', source: 'AI HTDD' };
        } else {
            const randomPred = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
            return { prediction: randomPred, reason: '[AI] Cân bằng, dự đoán ngẫu nhiên', source: 'AI HTDD' };
        }
    }
}

function generatePredictionV1(history) {
    if (!history || history.length === 0) {
        const randomPred = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomPred, reason: 'Không đủ lịch sử', scores: { taiScore: 0.5, xiuScore: 0.5 } };
    }
    if (!modelPredictionsV1.trend) {
        modelPredictionsV1 = {
            trend: {}, short: {}, mean: {}, switch: {}, bridge: {}
        };
    }
    const currentSession = history[history.length - 1].session;
    const trendPred = history.length < 5 ? (history[history.length - 1].result === 'Tài' ? 1 : 2) : trendAndProbV1(history);
    const shortPred = history.length < 5 ? (history[history.length - 1].result === 'Tài' ? 1 : 2) : shortPatternV1(history);
    const meanPred = history.length < 5 ? (history[history.length - 1].result === 'Tài' ? 1 : 2) : meanDeviationV1(history);
    const switchPred = history.length < 5 ? (history[history.length - 1].result === 'Tài' ? 1 : 2) : recentSwitchV1(history);
    const bridgePred = history.length < 5 ? { prediction: history[history.length - 1].result === 'Tài' ? 1 : 2, breakProb: 0, reason: 'Lịch sử ngắn' } : smartBridgeBreakV1(history);
    const aiPred = aiHtddLogicV1(history);

    modelPredictionsV1.trend[currentSession] = trendPred;
    modelPredictionsV1.short[currentSession] = shortPred;
    modelPredictionsV1.mean[currentSession] = meanPred;
    modelPredictionsV1.switch[currentSession] = switchPred;
    modelPredictionsV1.bridge[currentSession] = bridgePred.prediction;

    const modelPerformance = {
        trend: evaluateModelPerformanceV1(history, 'trend'),
        short: evaluateModelPerformanceV1(history, 'short'),
        mean: evaluateModelPerformanceV1(history, 'mean'),
        switch: evaluateModelPerformanceV1(history, 'switch'),
        bridge: evaluateModelPerformanceV1(history, 'bridge')
    };

    const modelWeights = {
        trend: 0.2 * modelPerformance.trend,
        short: 0.2 * modelPerformance.short,
        mean: 0.25 * modelPerformance.mean,
        switch: 0.2 * modelPerformance.switch,
        bridge: 0.15 * modelPerformance.bridge,
        aihtdd: 0.2
    };

    let taiScore = 0;
    let xiuScore = 0;

    if (trendPred === 1) taiScore += modelWeights.trend; else if (trendPred === 2) xiuScore += modelWeights.trend;
    if (shortPred === 1) taiScore += modelWeights.short; else if (shortPred === 2) xiuScore += modelWeights.short;
    if (meanPred === 1) taiScore += modelWeights.mean; else if (meanPred === 2) xiuScore += modelWeights.mean;
    if (switchPred === 1) taiScore += modelWeights.switch; else if (switchPred === 2) xiuScore += modelWeights.switch;
    if (bridgePred.prediction === 1) taiScore += modelWeights.bridge; else if (bridgePred.prediction === 2) xiuScore += modelWeights.bridge;
    if (aiPred.prediction === 'Tài') taiScore += modelWeights.aihtdd; else xiuScore += modelWeights.aihtdd;

    if (isBadPatternV1(history)) {
        taiScore *= 0.8;
        xiuScore *= 0.8;
    }
    const last10Results = history.slice(-10).map(item => item.result);
    const last10TaiCount = last10Results.filter(result => result === 'Tài').length;
    if (last10TaiCount >= 7) {
        xiuScore += 0.15;
    } else if (last10TaiCount <= 3) {
        taiScore += 0.15;
    }
    if (bridgePred.breakProb > 0.65) {
        if (bridgePred.prediction === 1) taiScore += 0.2;
        else xiuScore += 0.2;
    }
    const finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    return {
        prediction: finalPrediction,
        reason: `${aiPred.reason} | ${bridgePred.reason}`,
        scores: { taiScore, xiuScore }
    };
}

// =========================================================================
// CÁC HÀM THUẬT TOÁN ĐƯỢC CUNG CẤP TỪ USER - VER 2
// =========================================================================
let modelPredictionsV2 = {};

function detectStreakAndBreakV2(history) {
    if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
    let streak = 1;
    const currentResult = history[history.length - 1].result;
    for (let i = history.length - 2; i >= 0; i--) {
        if (history[i].result === currentResult) streak++;
        else break;
    }
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return { streak, currentResult, breakProb: 0.0 };
    const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
    const taiCount = last15.filter(r => r === 'Tài').length;
    const xiuCount = last15.filter(r => r === 'Xỉu').length;
    const imbalance = Math.abs(taiCount - xiuCount) / last15.length;
    let breakProb = 0.0;
    if (streak >= 6) {
        breakProb = Math.min(0.8 + (switches / 15) + imbalance * 0.3, 0.95);
    } else if (streak >= 4) {
        breakProb = Math.min(0.5 + (switches / 12) + imbalance * 0.25, 0.9);
    } else if (streak >= 2 && switches >= 5) {
        breakProb = 0.45;
    } else if (streak === 1 && switches >= 6) {
        breakProb = 0.3;
    }
    return { streak, currentResult, breakProb };
}

function evaluateModelPerformanceV2(history, modelName, lookback = 10) {
    if (!modelPredictionsV2[modelName] || history.length < 2) return 1.0;
    lookback = Math.min(lookback, history.length - 1);
    let correctCount = 0;
    for (let i = 0; i < lookback; i++) {
        const pred = modelPredictionsV2[modelName][history[history.length - (i + 2)].session] || 0;
        const actual = history[history.length - (i + 1)].result;
        if ((pred === 1 && actual === 'Tài') || (pred === 2 && actual === 'Xỉu')) {
            correctCount++;
        }
    }
    const performanceScore = lookback > 0 ? 1.0 + (correctCount - lookback / 2) / (lookback / 2) : 1.0;
    return Math.max(0.0, Math.min(2.0, performanceScore));
}

function smartBridgeBreakV2(history) {
    if (!history || history.length < 5) return { prediction: 0, breakProb: 0.0, reason: 'Không đủ dữ liệu để theo/bẻ cầu' };
    const { streak, currentResult, breakProb } = detectStreakAndBreakV2(history);
    const last20 = history.slice(-20).map(h => h.result);
    const lastScores = history.slice(-20).map(h => h.totalScore || 0);
    let breakProbability = breakProb;
    let reason = '';
    const avgScore = lastScores.reduce((sum, score) => sum + score, 0) / (lastScores.length || 1);
    const scoreDeviation = lastScores.reduce((sum, score) => sum + Math.abs(score - avgScore), 0) / (lastScores.length || 1);
    const last5 = last20.slice(-5);
    const patternCounts = {};
    for (let i = 0; i <= last20.length - 2; i++) {
        const pattern = last20.slice(i, i + 2).join(',');
        patternCounts[pattern] = (patternCounts[pattern] || 0) + 1;
    }
    const mostCommonPattern = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    const isStablePattern = mostCommonPattern && mostCommonPattern[1] >= 3;
    if (streak >= 3 && scoreDeviation < 2.0 && !isStablePattern) {
        breakProbability = Math.max(breakProbability - 0.25, 0.1);
        reason = `[Theo Cầu] Chuỗi ${streak} ${currentResult} ổn định, tiếp tục theo cầu`;
    } else if (streak >= 6) {
        breakProbability = Math.min(breakProbability + 0.3, 0.95);
        reason = `[Bẻ Cầu] Chuỗi ${streak} ${currentResult} quá dài, khả năng bẻ cầu cao`;
    } else if (streak >= 3 && scoreDeviation > 3.5) {
        breakProbability = Math.min(breakProbability + 0.25, 0.9);
        reason = `[Bẻ Cầu] Biến động điểm số lớn (${scoreDeviation.toFixed(1)}), khả năng bẻ cầu tăng`;
    } else if (isStablePattern && last5.every(r => r === currentResult)) {
        breakProbability = Math.min(breakProbability + 0.2, 0.85);
        reason = `[Bẻ Cầu] Phát hiện mẫu lặp ${mostCommonPattern[0]}, có khả năng bẻ cầu`;
    } else {
        breakProbability = Math.max(breakProbability - 0.2, 0.1);
        reason = `[Theo Cầu] Không phát hiện mẫu bẻ mạnh, tiếp tục theo cầu`;
    }
    let prediction = breakProbability > 0.5 ? (currentResult === 'Tài' ? 2 : 1) : (currentResult === 'Tài' ? 1 : 2);
    return { prediction, breakProb: breakProbability, reason };
}

function trendAndProbV2(history) {
    const { streak, currentResult, breakProb } = detectStreakAndBreakV2(history);
    if (streak >= 3) {
        if (breakProb > 0.6) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return 0;
    const weights = last15.map((_, i) => Math.pow(1.3, i));
    const taiWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Tài' ? w : 0), 0);
    const xiuWeighted = weights.reduce((sum, w, i) => sum + (last15[i] === 'Xỉu' ? w : 0), 0);
    const totalWeight = taiWeighted + xiuWeighted;
    const last10 = last15.slice(-10);
    const patterns = [];
    if (last10.length >= 4) {
        for (let i = 0; i <= last10.length - 4; i++) {
            patterns.push(last10.slice(i, i + 4).join(','));
        }
    }
    const patternCounts = patterns.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 3) {
        const pattern = mostCommon[0].split(',');
        return pattern[pattern.length - 1] !== last10[last10.length - 1] ? 1 : 2;
    } else if (totalWeight > 0 && Math.abs(taiWeighted - xiuWeighted) / totalWeight >= 0.25) {
        return taiWeighted > xiuWeighted ? 1 : 2;
    }
    return last15[last15.length - 1] === 'Xỉu' ? 1 : 2;
}

function shortPatternV2(history) {
    const { streak, currentResult, breakProb } = detectStreakAndBreakV2(history);
    if (streak >= 2) {
        if (breakProb > 0.6) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last8 = history.slice(-8).map(h => h.result);
    if (!last8.length) return 0;
    const patterns = [];
    if (last8.length >= 2) {
        for (let i = 0; i <= last8.length - 2; i++) {
            patterns.push(last8.slice(i, i + 2).join(','));
        }
    }
    const patternCounts = patterns.reduce((acc, p) => { acc[p] = (acc[p] || 0) + 1; return acc; }, {});
    const mostCommon = Object.entries(patternCounts).sort((a, b) => b[1] - a[1])[0];
    if (mostCommon && mostCommon[1] >= 2) {
        const pattern = mostCommon[0].split(',');
        return pattern[pattern.length - 1] !== last8[last8.length - 1] ? 1 : 2;
    }
    return last8[last8.length - 1] === 'Xỉu' ? 1 : 2;
}

function meanDeviationV2(history) {
    const { streak, currentResult, breakProb } = detectStreakAndBreakV2(history);
    if (streak >= 2) {
        if (breakProb > 0.6) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last12 = history.slice(-12).map(h => h.result);
    if (!last12.length) return 0;
    const taiCount = last12.filter(r => r === 'Tài').length;
    const xiuCount = last12.length - taiCount;
    const deviation = Math.abs(taiCount - xiuCount) / last12.length;
    if (deviation < 0.2) {
        return last12[last12.length - 1] === 'Xỉu' ? 1 : 2;
    }
    return xiuCount > taiCount ? 1 : 2;
}

function recentSwitchV2(history) {
    const { streak, currentResult, breakProb } = detectStreakAndBreakV2(history);
    if (streak >= 2) {
        if (breakProb > 0.6) return currentResult === 'Tài' ? 2 : 1;
        return currentResult === 'Tài' ? 1 : 2;
    }
    const last10 = history.slice(-10).map(h => h.result);
    if (!last10.length) return 0;
    const switches = last10.slice(1).reduce((count, curr, idx) => count + (curr !== last10[idx] ? 1 : 0), 0);
    return switches >= 4 ? (last10[last10.length - 1] === 'Xỉu' ? 1 : 2) : (last10[last10.length - 1] === 'Xỉu' ? 1 : 2);
}

function isBadPatternV2(history) {
    const last15 = history.slice(-15).map(h => h.result);
    if (!last15.length) return false;
    const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
    const { streak } = detectStreakAndBreakV2(history);
    return switches >= 6 || streak >= 7;
}

function aiHtddLogicV2(history) {
    const recentHistory = history.slice(-5).map(h => h.result);
    const recentScores = history.slice(-5).map(h => h.totalScore || 0);
    const taiCount = recentHistory.filter(r => r === 'Tài').length;
    const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;
    const { streak, currentResult } = detectStreakAndBreakV2(history);

    if (history.length < 5) {
        const randomPred = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomPred, reason: '[AI Pro] Không đủ lịch sử, dự đoán ngẫu nhiên', source: 'AI Pro' };
    }
    
    if (streak >= 2 && streak <= 4) {
        return { prediction: currentResult, reason: `[AI Pro] Chuỗi ngắn ${streak} ${currentResult}, tiếp tục theo cầu`, source: 'AI Pro' };
    }
    if (history.length >= 3) {
        const last3 = history.slice(-3).map(h => h.result);
        if (last3.join(',') === 'Tài,Xỉu,Tài') return { prediction: 'Xỉu', reason: '[AI Pro] Phát hiện mẫu 1T1X → nên đánh Xỉu', source: 'AI Pro' };
        if (last3.join(',') === 'Xỉu,Tài,Xỉu') return { prediction: 'Tài', reason: '[AI Pro] Phát hiện mẫu 1X1T → nên đánh Tài', source: 'AI Pro' };
    }
    if (history.length >= 4) {
        const last4 = history.slice(-4).map(h => h.result);
        if (last4.join(',') === 'Tài,Tài,Xỉu,Xỉu') return { prediction: 'Tài', reason: '[AI Pro] Phát hiện mẫu 2T2X → nên đánh Tài', source: 'AI Pro' };
        if (last4.join(',') === 'Xỉu,Xỉu,Tài,Tài') return { prediction: 'Xỉu', reason: '[AI Pro] Phát hiện mẫu 2X2T → nên đánh Xỉu', source: 'AI Pro' };
    }
    if (history.length >= 7 && history.slice(-7).every(h => h.result === 'Xỉu')) return { prediction: 'Tài', reason: '[AI Pro] Chuỗi Xỉu quá dài (7 lần) → dự đoán Tài', source: 'AI Pro' };
    if (history.length >= 7 && history.slice(-7).every(h => h.result === 'Tài')) return { prediction: 'Xỉu', reason: '[AI Pro] Chuỗi Tài quá dài (7 lần) → dự đoán Xỉu', source: 'AI Pro' };
    
    const avgScore = recentScores.reduce((sum, score) => sum + score, 0) / (recentScores.length || 1);
    if (avgScore > 11) return { prediction: 'Tài', reason: `[AI Pro] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'AI Pro' };
    if (avgScore < 7) return { prediction: 'Xỉu', reason: `[AI Pro] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'AI Pro' };
    
    if (taiCount > xiuCount + 1) return { prediction: 'Xỉu', reason: `[AI Pro] Tài chiếm đa số (${taiCount}/${recentHistory.length}) → dự đoán Xỉu`, source: 'AI Pro' };
    if (xiuCount > taiCount + 1) return { prediction: 'Tài', reason: `[AI Pro] Xỉu chiếm đa số (${xiuCount}/${recentHistory.length}) → dự đoán Tài`, source: 'AI Pro' };
    
    const overallTai = history.filter(h => h.result === 'Tài').length;
    const overallXiu = history.filter(h => h.result === 'Xỉu').length;
    if (overallTai > overallXiu) return { prediction: 'Xỉu', reason: '[AI Pro] Tổng thể Tài nhiều hơn → dự đoán Xỉu', source: 'AI Pro' };
    return { prediction: 'Tài', reason: '[AI Pro] Tổng thể Xỉu nhiều hơn hoặc bằng → dự đoán Tài', source: 'AI Pro' };
}

function generatePredictionV2(history) {
    if (!history || history.length < 5) {
        const randomResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return { prediction: randomResult, reason: 'Không đủ lịch sử', scores: { taiScore: 0.5, xiuScore: 0.5 } };
    }
    if (!modelPredictionsV2['trend']) {
        modelPredictionsV2['trend'] = {}; modelPredictionsV2['short'] = {};
        modelPredictionsV2['mean'] = {}; modelPredictionsV2['switch'] = {};
        modelPredictionsV2['bridge'] = {};
    }
    const currentIndex = history[history.length - 1].session;
    const { streak } = detectStreakAndBreakV2(history);
    const trendPred = trendAndProbV2(history);
    const shortPred = shortPatternV2(history);
    const meanPred = meanDeviationV2(history);
    const switchPred = recentSwitchV2(history);
    const bridgePred = smartBridgeBreakV2(history);
    const aiPred = aiHtddLogicV2(history);

    modelPredictionsV2['trend'][currentIndex] = trendPred;
    modelPredictionsV2['short'][currentIndex] = shortPred;
    modelPredictionsV2['mean'][currentIndex] = meanPred;
    modelPredictionsV2['switch'][currentIndex] = switchPred;
    modelPredictionsV2['bridge'][currentIndex] = bridgePred.prediction;

    const modelScores = {
        trend: evaluateModelPerformanceV2(history, 'trend'),
        short: evaluateModelPerformanceV2(history, 'short'),
        mean: evaluateModelPerformanceV2(history, 'mean'),
        switch: evaluateModelPerformanceV2(history, 'switch'),
        bridge: evaluateModelPerformanceV2(history, 'bridge')
    };

    const weights = {
        trend: streak >= 3 ? 0.15 * modelScores.trend : 0.2 * modelScores.trend,
        short: streak >= 2 ? 0.2 * modelScores.short : 0.15 * modelScores.short,
        mean: 0.1 * modelScores.mean,
        switch: 0.1 * modelScores.switch,
        bridge: streak >= 3 ? 0.35 * modelScores.bridge : 0.3 * modelScores.bridge,
        aihtdd: streak >= 2 ? 0.3 : 0.25
    };
    let taiScore = 0;
    let xiuScore = 0;

    if (trendPred === 1) taiScore += weights.trend; else if (trendPred === 2) xiuScore += weights.trend;
    if (shortPred === 1) taiScore += weights.short; else if (shortPred === 2) xiuScore += weights.short;
    if (meanPred === 1) taiScore += weights.mean; else if (meanPred === 2) xiuScore += weights.mean;
    if (switchPred === 1) taiScore += weights.switch; else if (switchPred === 2) xiuScore += weights.switch;
    if (bridgePred.prediction === 1) taiScore += weights.bridge; else if (bridgePred.prediction === 2) xiuScore += weights.bridge;
    if (aiPred.prediction === 'Tài') taiScore += weights.aihtdd; else xiuScore += weights.aihtdd;

    if (isBadPatternV2(history)) {
        taiScore *= 0.5;
        xiuScore *= 0.5;
    }
    if (bridgePred.breakProb > 0.5) {
        if (bridgePred.prediction === 1) taiScore += 0.4; else xiuScore += 0.4;
    } else if (streak >= 3) {
        if (bridgePred.prediction === 1) taiScore += 0.35; else xiuScore += 0.35;
    }

    const finalPrediction = taiScore > xiuScore ? 'Tài' : 'Xỉu';
    return {
        prediction: finalPrediction,
        reason: `${aiPred.reason} | ${bridgePred.reason}`,
        scores: { taiScore, xiuScore }
    };
}


// =========================================================================
// HÀM HỢP NHẤT VÀ API CHÍNH
// =========================================================================
function generateSuperProPrediction(history) {
    if (!history || history.length < 1) {
        const randomResult = Math.random() < 0.5 ? 'Tài' : 'Xỉu';
        return {
            phien: null, xuc_xac: null, tong: null, ket_qua: null, phien_sau: 1, du_doan: randomResult,
            do_tin_cay: 50, giai_thich: 'Không có dữ liệu lịch sử. Dự đoán ngẫu nhiên.',
            cau_xau_dep: 'Chưa đủ dữ liệu', status_phan_tich: 'Cần thêm dữ liệu', so_phien_da_phan_tich: 0
        };
    }
    
    // Chạy đồng thời cả hai phiên bản thuật toán
    const resultV1 = generatePredictionV1(history);
    const resultV2 = generatePredictionV2(history);

    // Tính điểm tổng hợp (V2 có trọng số cao hơn)
    const finalTaiScore = (resultV1.scores.taiScore * 0.4) + (resultV2.scores.taiScore * 0.6);
    const finalXiuScore = (resultV1.scores.xiuScore * 0.4) + (resultV2.scores.xiuScore * 0.6);

    // Phân tích độ tin cậy và cầu xấu/đẹp
    const isBadPattern = isBadPatternV1(history) || isBadPatternV2(history);
    let doTinCay = Math.max(finalTaiScore, finalXiuScore) * 100;
    let cauXauDep = 'Cầu đẹp, nên chơi';

    if (isBadPattern) {
        doTinCay = doTinCay * 0.5;
        cauXauDep = 'Cầu xấu, nên cẩn thận';
    } else if (resultV1.prediction === resultV2.prediction) {
        doTinCay = doTinCay * 1.1;
    }

    doTinCay = Math.round(Math.min(100, doTinCay));

    // Dự đoán cuối cùng
    const finalPrediction = finalTaiScore > finalXiuScore ? 'Tài' : 'Xỉu';

    // Xây dựng giải thích
    const giaiThich = `Dự đoán V1: ${resultV1.reason}. Dự đoán V2: ${resultV2.reason}. SUPER AI đã tổng hợp và đưa ra dự đoán cuối cùng.`;

    const statusPhanTich = history.length < 5 ? 'Cần thêm dữ liệu' : 'Phân tích thành công';

    const latestSession = history[history.length - 1];
    return {
        phien: latestSession.session,
        xuc_xac: latestSession.dice,
        tong: latestSession.total,
        ket_qua: latestSession.result,
        phien_sau: latestSession.session + 1,
        du_doan: finalPrediction,
        do_tin_cay: doTinCay,
        giai_thich: giaiThich,
        cau_xau_dep: cauXauDep,
        status_phan_tich: statusPhanTich,
        so_phien_da_phan_tich: history.length,
    };
}

// Endpoint API chính
app.get('/api/taixiu/predict', async (req, res) => {
    try {
        const response = await axios.get('https://sunlol.onrender.com/myapi/taixiu/history');
        const history = response.data.history;

        const predictionResult = generateSuperProPrediction(history);
        
        res.json(predictionResult);
    } catch (error) {
        console.error('Lỗi khi lấy dữ liệu hoặc xử lý dự đoán:', error.message);
        res.status(500).json({ status_phan_tich: 'Lỗi', message: 'Không thể phân tích dữ liệu từ nguồn' });
    }
});

app.listen(PORT, () => {
    console.log(`SUPER PRO AI API is running on port ${PORT}`);
});
