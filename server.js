const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const app = express();
const PORT = process.env.PORT || 3000;

// Cache for historical data, set to expire after 30 minutes
const historicalDataCache = new NodeCache({ stdTTL: 1800, checkperiod: 60 });
const NEW_API_URL = 'https://sunlol.onrender.com/myapi/taixiu/history';

// Object to store predictions for evaluation
const modelPredictions = {
    trend: {},
    short: {},
    mean: {},
    switch: {},
    bridge: {},
    vannhat: {},
    deepcycle: {},
    aihtdd: {},
    supernova: {},
    trader_x: {},
    phapsu_ai: {},
    thanluc_ai: {}
};

// Class to manage historical session data
class HistoricalDataManager {
    constructor(maxHistoryLength = 5000) {
        this.history = [];
        this.maxHistoryLength = maxHistoryLength;
    }

    addSession(newData) {
        if (!newData || !newData.session) return false;
        // Check for duplicate sessions to prevent adding the same data multiple times
        if (this.history.some(item => item.session === newData.session)) return false;
        this.history.push(newData);
        if (this.history.length > this.maxHistoryLength) {
            // Trim old data if history exceeds max length
            this.history = this.history.slice(this.history.length - this.maxHistoryLength);
        }
        // Always keep history sorted by session number
        this.history.sort((a, b) => a.session - b.session);
        return true;
    }

    getHistory() {
        return [...this.history];
    }
}

// Class for the core prediction logic
class PredictionEngine {
    constructor(historyMgr) {
        this.historyMgr = historyMgr;
        this.mlModel = null;
        this.deepLearningModel = null;
        this.divineModel = null;
    }

    // Trains the different models based on historical data
    trainModels() {
        const history = this.historyMgr.getHistory();
        if (history.length < 10) {
            this.mlModel = null;
            this.deepLearningModel = null;
            this.divineModel = null;
            return;
        }

        const taiData = history.filter(h => h.result === 'Tài');
        const xiuData = history.filter(h => h.result === 'Xỉu');

        const taiFreq = taiData.length / history.length;
        const xiuFreq = xiuData.length / history.length;

        // Calculate average streak length for Tai and Xiu
        const taiStreakAvg = taiData.reduce((sum, h, i) => {
            if (i > 0 && taiData[i - 1].session === h.session - 1) return sum + 1;
            return sum;
        }, 0) / taiData.length;

        const xiuStreakAvg = xiuData.reduce((sum, h, i) => {
            if (i > 0 && xiuData[i - 1].session === h.session - 1) return sum + 1;
            return sum;
        }, 0) / xiuData.length;

        this.mlModel = { taiFreq, xiuFreq, taiStreakAvg, xiuStreakAvg };

        // Deep learning model features from the last 100 sessions
        const last100 = history.slice(-100);
        const last100Results = last100.map(h => h.result);
        const last100Scores = last100.map(h => h.total || 0);
        this.deepLearningModel = {
            taiDominance: last100Results.filter(r => r === 'Tài').length > last100.length * 0.6,
            xiuDominance: last100Results.filter(r => r === 'Xỉu').length > last100.length * 0.6,
            highVariance: last100Scores.some(score => score > 14 || score < 6)
        };

        // Divine model pattern detection from the last 200 sessions
        const last200 = history.slice(-200);
        const uniquePatterns = {};
        for (let i = 0; i < last200.length - 5; i++) {
            const pattern = last200.slice(i, i + 5).map(h => h.result).join(',');
            uniquePatterns[pattern] = (uniquePatterns[pattern] || 0) + 1;
        }
        const commonPattern = Object.entries(uniquePatterns).filter(([, count]) => count > 1);
        this.divineModel = {
            hasRepeatedPattern: commonPattern.length > 0,
            mostCommonPattern: commonPattern[0]?.[0]
        };
    }

    // Individual prediction models
    traderX(history) {
        if (!this.mlModel) {
            return { prediction: 'Chờ đợi', reason: '[TRADER X] Not enough data to train' };
        }
        const last10 = history.slice(-10).map(h => h.result);
        const currentStreak = this.detectStreakAndBreak(history).streak;
        const taiInLast10 = last10.filter(r => r === 'Tài').length;
        const xiuInLast10 = last10.filter(r => r === 'Xỉu').length;
        if (taiInLast10 / 10 > this.mlModel.taiFreq * 1.5 && currentStreak >= this.mlModel.taiStreakAvg + 1) {
            return { prediction: 'Xỉu', reason: '[TRADER X] Tai pattern is above average, predicting switch to Xiu' };
        }
        if (xiuInLast10 / 10 > this.mlModel.xiuFreq * 1.5 && currentStreak >= this.mlModel.xiuStreakAvg + 1) {
            return { prediction: 'Tài', reason: '[TRADER X] Xiu pattern is above average, predicting switch to Tai' };
        }
        return { prediction: 'Chờ đợi', reason: '[TRADER X] No special pattern detected from Machine Learning' };
    }

    phapsuAI(history) {
        if (!this.deepLearningModel || history.length < 50) {
            return { prediction: 'Chờ đợi', reason: '[PHÁP SƯ AI] Not enough data to activate Phap Su AI' };
        }
        const last3 = history.slice(-3).map(h => h.result);
        const last5Scores = history.slice(-5).map(h => h.total || 0);
        const avgScore = last5Scores.reduce((sum, score) => sum + score, 0) / last5Scores.length;
        if (this.deepLearningModel.taiDominance && last3.join(',') === 'Tài,Tài,Tài') {
            return { prediction: 'Xỉu', reason: '[PHÁP SƯ AI] Detected 3 consecutive Tai in a dominant Tai cycle, predicting switch' };
        }
        if (this.deepLearningModel.xiuDominance && last3.join(',') === 'Xỉu,Xỉu,Xỉu') {
            return { prediction: 'Tài', reason: '[PHÁP SƯ AI] Detected 3 consecutive Xiu in a dominant Xiu cycle, predicting switch' };
        }
        if (this.deepLearningModel.highVariance && avgScore > 13) {
            return { prediction: 'Xỉu', reason: '[PHÁP SƯ AI] Detected unusually high score in a high variance cycle' };
        }
        if (this.deepLearningModel.highVariance && avgScore < 7) {
            return { prediction: 'Tài', reason: '[PHÁP SƯ AI] Detected unusually low score in a high variance cycle' };
        }
        return { prediction: 'Chờ đợi', reason: '[PHÁP SƯ AI] No system error found' };
    }

    thanlucAI(history) {
        if (!this.divineModel || history.length < 50) {
            return { prediction: 'Chờ đợi', reason: '[THẦN LỰC AI] Not enough data to activate Than Luc AI' };
        }
        const { streak, currentResult } = this.detectStreakAndBreak(history);
        const last5 = history.slice(-5).map(h => h.result).join(',');

        if (this.divineModel.hasRepeatedPattern && this.divineModel.mostCommonPattern === last5) {
            const patternArray = this.divineModel.mostCommonPattern.split(',');
            const nextPred = patternArray.length > 0 ? (patternArray[patternArray.length - 1] === 'Tài' ? 'Xỉu' : 'Tài') : 'Chờ đợi';
            return { prediction: nextPred, reason: `[THẦN LỰC AI] Detected repeating pattern ${last5} -> predicting switch`, source: 'THẦN LỰC' };
        }
        if (streak >= 7) {
            return { prediction: currentResult === 'Tài' ? 'Xỉu' : 'Tài', reason: `[THẦN LỰC AI] ${currentResult} streak exceeds limit of ${streak} times, certain switch!`, source: 'THẦN LỰC' };
        }
        return { prediction: 'Chờ đợi', reason: '[THẦN LỰC AI] No supernatural signal detected', source: 'THẦN LỰC' };
    }

    detectStreakAndBreak(history) {
        if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
        let streak = 1;
        const currentResult = history[history.length - 1].result;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].result === currentResult) {
                streak++;
            } else {
                break;
            }
        }
        const last15 = history.slice(-15).map(h => h.result);
        if (!last15.length) return { streak, currentResult, breakProb: 0.0 };
        const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
        const taiCount = last15.filter(r => r === 'Tài').length;
        const xiuCount = last15.length - taiCount;
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

    evaluateModelPerformance(history, modelName, lookback = 10) {
        if (!modelPredictions[modelName] || history.length < 2) return 1.0;
        lookback = Math.min(lookback, history.length - 1);
        let correctCount = 0;
        for (let i = 0; i < lookback; i++) {
            const historyIndex = history.length - (i + 2);
            const pred = modelPredictions[modelName][history[historyIndex].session];
            const actual = history[history.length - (i + 1)].result;
            if (pred && ((pred === 'Tài' && actual === 'Tài') || (pred === 'Xỉu' && actual === 'Xỉu'))) {
                correctCount++;
            }
        }
        const accuracy = lookback > 0 ? correctCount / lookback : 0.5;
        const performanceScore = 1.0 + (accuracy - 0.5);
        return Math.max(0.0, Math.min(2.0, performanceScore));
    }

    supernovaAI(history) {
        const historyLength = history.length;
        if (historyLength < 20) return { prediction: 'Chờ đợi', reason: 'Not enough data for Supernova AI', source: 'SUPERNOVA' };
        const last30Scores = history.slice(-30).map(h => h.total || 0);
        const avgScore = last30Scores.reduce((sum, score) => sum + score, 0) / 30;
        const scoreStdDev = Math.sqrt(last30Scores.map(x => Math.pow(x - avgScore, 2)).reduce((a, b) => a + b) / 30);
        const lastScore = last30Scores[last30Scores.length - 1];
        if (lastScore > avgScore + scoreStdDev * 2) {
            return { prediction: 'Xỉu', reason: `[SUPERNOVA] Recent score (${lastScore}) is too high compared to average, predicting switch`, source: 'SUPERNOVA' };
        }
        if (lastScore < avgScore - scoreStdDev * 2) {
            return { prediction: 'Tài', reason: `[SUPERNOVA] Recent score (${lastScore}) is too low compared to average, predicting switch`, source: 'SUPERNOVA' };
        }
        const last6 = history.slice(-6).map(h => h.result);
        if (last6.join(',') === 'Tài,Xỉu,Tài,Xỉu,Tài,Xỉu' || last6.join(',') === 'Xỉu,Tài,Xỉu,Tài,Xỉu,Tài') {
            const nextPred = last6[last6.length - 1] === 'Tài' ? 'Xỉu' : 'Tài';
            return { prediction: nextPred, reason: `[SUPERNOVA] Detected long-term 1-1 pattern, following pattern`, source: 'SUPERNOVA' };
        }
        return { prediction: 'Chờ đợi', reason: '[SUPERNOVA] No super-standard signal detected', source: 'SUPERNOVA' };
    }

    deepCycleAI(history) {
        const historyLength = history.length;
        if (historyLength < 20) return { prediction: 'Chờ đợi', reason: 'Not enough data for DeepCycleAI' };
        const last50 = history.slice(-50).map(h => h.result);
        const last15 = history.slice(-15).map(h => h.result);
        const taiCounts = [];
        const xiuCounts = [];
        for (let i = 0; i < last50.length - 10; i++) {
            const subArray = last50.slice(i, i + 10);
            taiCounts.push(subArray.filter(r => r === 'Tài').length);
            xiuCounts.push(subArray.filter(r => r === 'Xỉu').length);
        }
        const avgTai = taiCounts.reduce((sum, count) => sum + count, 0) / taiCounts.length;
        const avgXiu = xiuCounts.reduce((sum, count) => sum + count, 0) / xiuCounts.length;
        const currentTaiCount = last15.filter(r => r === 'Tài').length;
        const currentXiuCount = last15.filter(r => r === 'Xỉu').length;
        if (currentTaiCount > avgTai + 3) {
            return { prediction: 'Xỉu', reason: '[DeepCycleAI] Tai cycle is peaking, predicting switch to Xiu.' };
        }
        if (currentXiuCount > avgXiu + 3) {
            return { prediction: 'Tài', reason: '[DeepCycleAI] Xiu cycle is peaking, predicting switch to Tai.' };
        }
        return { prediction: 'Chờ đợi', reason: '[DeepCycleAI] No clear cycle detected.' };
    }

    aihtddLogic(history) {
        if (!history || history.length < 3) {
            return { prediction: 'Chờ đợi', reason: '[AI VANNHAT] Not enough history for deep analysis', source: 'AI VANNHAT' };
        }
        const last5Results = history.slice(-5).map(item => item.result);
        const last5Scores = history.slice(-5).map(item => item.total || 0);
        const taiCount = last5Results.filter(result => result === 'Tài').length;
        const xiuCount = last5Results.filter(result => result === 'Xỉu').length;
        if (history.length >= 3) {
            const last3Results = history.slice(-3).map(item => item.result);
            if (last3Results.join(',') === 'Tài,Xỉu,Tài') {
                return { prediction: 'Xỉu', reason: '[AI VANNHAT] Detected 1T1X pattern -> bet on Xiu', source: 'AI VANNHAT' };
            } else if (last3Results.join(',') === 'Xỉu,Tài,Xỉu') {
                return { prediction: 'Tài', reason: '[AI VANNHAT] Detected 1X1T pattern -> bet on Tai', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 4) {
            const last4Results = history.slice(-4).map(item => item.result);
            if (last4Results.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
                return { prediction: 'Tài', reason: '[AI VANNHAT] Detected 2T2X pattern -> bet on Tai', source: 'AI VANNHAT' };
            } else if (last4Results.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
                return { prediction: 'Xỉu', reason: '[AI VANNHAT] Detected 2X2T pattern -> bet on Xiu', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 9 && history.slice(-6).every(item => item.result === 'Tài')) {
            return { prediction: 'Xỉu', reason: '[AI VANNHAT] Tai streak is too long (6 times) -> predicting Xiu', source: 'AI VANNHAT' };
        } else if (history.length >= 9 && history.slice(-6).every(item => item.result === 'Xỉu')) {
            return { prediction: 'Tài', reason: '[AI VANNHAT] Xiu streak is too long (6 times) -> predicting Tai', source: 'AI VANNHAT' };
        }
        const avgScore = last5Scores.reduce((sum, score) => sum + score, 0) / (last5Scores.length || 1);
        if (avgScore > 10) {
            return { prediction: 'Tài', reason: `[AI VANNHAT] High average score (${avgScore.toFixed(1)}) -> predicting Tai`, source: 'AI VANNHAT' };
        } else if (avgScore < 8) {
            return { prediction: 'Xỉu', reason: `[AI VANNHAT] Low average score (${avgScore.toFixed(1)}) -> predicting Xiu`, source: 'AI VANNHAT' };
        }
        if (taiCount > xiuCount + 1) {
            return { prediction: 'Xỉu', reason: `[AI VANNHAT] Tai is dominant (${taiCount}/${last5Results.length}) -> predicting Xiu`, source: 'AI VANNHAT' };
        } else if (xiuCount > taiCount + 1) {
            return { prediction: 'Tài', reason: `[AI VANNHAT] Xiu is dominant (${xiuCount}/${last5Results.length}) -> predicting Tai`, source: 'AI VANNHAT' };
        } else {
            const overallTai = history.filter(h => h.result === 'Tài').length;
            const overallXiu = history.filter(h => h.result === 'Xỉu').length;
            if (overallTai > overallXiu) {
                return { prediction: 'Xỉu', reason: '[Smart Bridge Break] Overall Tai is more frequent -> predicting Xiu', source: 'AI VANNHAT' };
            } else {
                return { prediction: 'Tài', reason: '[Smart Bridge Follow] Overall Xiu is more frequent or equal -> predicting Tai', source: 'AI VANNHAT' };
            }
        }
    }

    smartBridgeBreak(history) {
        if (!history || history.length < 5) return { prediction: 'Chờ đợi', breakProb: 0.0, reason: 'Not enough data to follow/break bridge' };
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        const last20 = history.slice(-20).map(h => h.result);
        const lastScores = history.slice(-20).map(h => h.total || 0);
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
            reason = `[Smart Bridge Follow] Stable ${streak} ${currentResult} streak, continuing to follow`;
        } else if (streak >= 6) {
            breakProbability = Math.min(breakProbability + 0.3, 0.95);
            reason = `[Smart Bridge Break] Long ${streak} ${currentResult} streak, high probability of breaking`;
        } else if (streak >= 3 && scoreDeviation > 3.5) {
            breakProbability = Math.min(breakProbability + 0.25, 0.9);
            reason = `[Smart Bridge Break] High score deviation (${scoreDeviation.toFixed(1)}), increased chance of breaking`;
        } else if (isStablePattern && last5.every(r => r === currentResult)) {
            breakProbability = Math.min(breakProbability + 0.2, 0.85);
            reason = `[Smart Bridge Break] Detected repeating pattern ${mostCommonPattern[0]}, likely to break`;
        } else {
            breakProbability = Math.max(breakProbability - 0.2, 0.1);
            reason = `[Smart Bridge Follow] No strong break pattern detected, continuing to follow`;
        }
        let prediction = breakProbability > 0.5 ? (currentResult === 'Tài' ? 'Xỉu' : 'Tài') : currentResult;
        return { prediction, breakProb: breakProbability, reason };
    }

    trendAndProb(history) {
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        if (streak >= 3) {
            if (breakProb > 0.6) return currentResult === 'Tài' ? 'Xỉu' : 'Tài';
            return currentResult;
        }
        const last15 = history.slice(-15).map(h => h.result);
        if (!last15.length) return 'Chờ đợi';
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
            return pattern[pattern.length - 1] === last10[last10.length - 1] ? 'Tài' : 'Xỉu';
        } else if (totalWeight > 0 && Math.abs(taiWeighted - xiuWeighted) / totalWeight >= 0.25) {
            return taiWeighted > xiuWeighted ? 'Tài' : 'Xỉu';
        }
        return last15[last15.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu';
    }

    shortPattern(history) {
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        if (streak >= 2) {
            if (breakProb > 0.6) return currentResult === 'Tài' ? 'Xỉu' : 'Tài';
            return currentResult;
        }
        const last8 = history.slice(-8).map(h => h.result);
        if (!last8.length) return 'Chờ đợi';
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
            return pattern[pattern.length - 1] === last8[last8.length - 1] ? 'Tài' : 'Xỉu';
        }
        return last8[last8.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu';
    }

    meanDeviation(history) {
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        if (streak >= 2) {
            if (breakProb > 0.6) return currentResult === 'Tài' ? 'Xỉu' : 'Tài';
            return currentResult;
        }
        const last12 = history.slice(-12).map(h => h.result);
        if (!last12.length) return 'Chờ đợi';
        const taiCount = last12.filter(r => r === 'Tài').length;
        const xiuCount = last12.length - taiCount;
        const deviation = Math.abs(taiCount - xiuCount) / last12.length;
        if (deviation < 0.2) {
            return last12[last12.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu';
        }
        return xiuCount > taiCount ? 'Tài' : 'Xỉu';
    }

    recentSwitch(history) {
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        if (streak >= 2) {
            if (breakProb > 0.6) return currentResult === 'Tài' ? 'Xỉu' : 'Tài';
            return currentResult;
        }
        const last10 = history.slice(-10).map(h => h.result);
        if (!last10.length) return 'Chờ đợi';
        const switches = last10.slice(1).reduce((count, curr, idx) => count + (curr !== last10[idx] ? 1 : 0), 0);
        return switches >= 4 ? (last10[last10.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu') : (last10[last10.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu');
    }

    isBadPattern(history) {
        const last15 = history.slice(-15).map(h => h.result);
        if (!last15.length) return false;
        const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
        const { streak } = this.detectStreakAndBreak(history);
        return switches >= 6 || streak >= 7;
    }

    aiVannhatLogic(history) {
        const recentHistory = history.slice(-5).map(h => h.result);
        const recentScores = history.slice(-5).map(h => h.total || 0);
        const taiCount = recentHistory.filter(r => r === 'Tài').length;
        const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;
        const { streak, currentResult } = this.detectStreakAndBreak(history);
        if (streak >= 2 && streak <= 4) {
            return { prediction: currentResult, reason: `[Smart Bridge Follow] Short streak of ${streak} ${currentResult}, continue to follow`, source: 'AI VANNHAT' };
        }
        if (history.length >= 3) {
            const last3 = history.slice(-3).map(h => h.result);
            if (last3.join(',') === 'Tài,Xỉu,Tài') {
                return { prediction: 'Xỉu', reason: '[Smart Bridge Break] Detected 1T1X pattern -> next should be Xiu', source: 'AI VANNHAT' };
            } else if (last3.join(',') === 'Xỉu,Tài,Xỉu') {
                return { prediction: 'Tài', reason: '[Smart Bridge Break] Detected 1X1T pattern -> next should be Tai', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 4) {
            const last4 = history.slice(-4).map(h => h.result);
            if (last4.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
                return { prediction: 'Tài', reason: '[Smart Bridge Follow] Detected 2T2X pattern -> next should be Tai', source: 'AI VANNHAT' };
            } else if (last4.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
                return { prediction: 'Xỉu', reason: '[Smart Bridge Follow] Detected 2X2T pattern -> next should be Xiu', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 7 && history.slice(-7).every(h => h.result === 'Xỉu')) {
            return { prediction: 'Tài', reason: '[Smart Bridge Break] Xiu streak is too long (7 times) -> predicting Tai', source: 'AI VANNHAT' };
        } else if (history.length >= 7 && history.slice(-7).every(h => h.result === 'Tài')) {
            return { prediction: 'Xỉu', reason: '[Smart Bridge Break] Tai streak is too long (7 times) -> predicting Xiu', source: 'AI VANNHAT' };
        }
        const avgScore = recentScores.reduce((sum, score) => sum + score, 0) / (recentScores.length || 1);
        if (avgScore > 11) {
            return { prediction: 'Tài', reason: `[Smart Bridge Follow] High average score (${avgScore.toFixed(1)}) -> predicting Tai`, source: 'AI VANNHAT' };
        } else if (avgScore < 7) {
            return { prediction: 'Xỉu', reason: `[Smart Bridge Follow] Low average score (${avgScore.toFixed(1)}) -> predicting Xiu`, source: 'AI VANNHAT' };
        }
        if (taiCount > xiuCount + 1) {
            return { prediction: 'Xỉu', reason: `[Smart Bridge Break] Tai is dominant (${taiCount}/${recentHistory.length}) -> predicting Xiu`, source: 'AI VANNHAT' };
        } else if (xiuCount > taiCount + 1) {
            return { prediction: 'Tài', reason: `[Smart Bridge Break] Xiu is dominant (${xiuCount}/${recentHistory.length}) -> predicting Tai`, source: 'AI VANNHAT' };
        } else {
            const overallTai = history.filter(h => h.result === 'Tài').length;
            const overallXiu = history.filter(h => h.result === 'Xỉu').length;
            if (overallTai > overallXiu) {
                return { prediction: 'Xỉu', reason: '[Smart Bridge Break] Overall Tai is more frequent -> predicting Xiu', source: 'AI VANNHAT' };
            } else {
                return { prediction: 'Tài', reason: '[Smart Bridge Follow] Overall Xiu is more frequent or equal -> predicting Tai', source: 'AI VANNHAT' };
            }
        }
    }

    buildResult(du_doan, do_tin_cay, giai_thich, pattern, status = "Thường") {
        return {
            du_doan: du_doan,
            do_tin_cay: parseFloat(do_tin_cay.toFixed(2)),
            giai_thich: giai_thich,
            pattern_nhan_dien: pattern,
            status_phan_tich: status
        };
    }

    // Main prediction function
    predict() {
        const history = this.historyMgr.getHistory();
        const historyLength = history.length;

        if (historyLength < 5) {
            return this.buildResult("Chờ đợi", 10, 'History too short to analyze. Need at least 5 sessions.', 'Not enough data', 'Very high risk');
        }

        this.trainModels();

        // Get predictions from all individual models
        const trendPred = this.trendAndProb(history);
        const shortPred = this.shortPattern(history);
        const meanPred = this.meanDeviation(history);
        const switchPred = this.recentSwitch(history);
        const bridgePred = this.smartBridgeBreak(history);
        const aiVannhatPred = this.aiVannhatLogic(history);
        const deepCyclePred = this.deepCycleAI(history);
        const aiHtddPred = this.aihtddLogic(history);
        const supernovaPred = this.supernovaAI(history);
        const traderXPred = this.traderX(history);
        const phapsuPred = this.phapsuAI(history);
        const thanlucPred = this.thanlucAI(history);

        const currentIndex = history[history.length - 1].session;
        modelPredictions.trend[currentIndex] = trendPred;
        modelPredictions.short[currentIndex] = shortPred;
        modelPredictions.mean[currentIndex] = meanPred;
        modelPredictions.switch[currentIndex] = switchPred;
        modelPredictions.bridge[currentIndex] = bridgePred.prediction;
        modelPredictions.vannhat[currentIndex] = aiVannhatPred.prediction;
        modelPredictions.deepcycle[currentIndex] = deepCyclePred.prediction;
        modelPredictions.aihtdd[currentIndex] = aiHtddPred.prediction;
        modelPredictions.supernova[currentIndex] = supernovaPred.prediction;
        modelPredictions.trader_x[currentIndex] = traderXPred.prediction;
        modelPredictions.phapsu_ai[currentIndex] = phapsuPred.prediction;
        modelPredictions.thanluc_ai[currentIndex] = thanlucPred.prediction;

        // Evaluate model performance to get a score multiplier
        const modelScores = {
            trend: this.evaluateModelPerformance(history, 'trend'),
            short: this.evaluateModelPerformance(history, 'short'),
            mean: this.evaluateModelPerformance(history, 'mean'),
            switch: this.evaluateModelPerformance(history, 'switch'),
            bridge: this.evaluateModelPerformance(history, 'bridge'),
            vannhat: this.evaluateModelPerformance(history, 'vannhat'),
            deepcycle: this.evaluateModelPerformance(history, 'deepcycle'),
            aihtdd: this.evaluateModelPerformance(history, 'aihtdd'),
            supernova: this.evaluateModelPerformance(history, 'supernova'),
            trader_x: this.evaluateModelPerformance(history, 'trader_x'),
            phapsu_ai: this.evaluateModelPerformance(history, 'phapsu_ai'),
            thanluc_ai: this.evaluateModelPerformance(history, 'thanluc_ai')
        };

        const baseWeights = {
            trend: 0.05,
            short: 0.05,
            mean: 0.05,
            switch: 0.05,
            bridge: 0.1,
            vannhat: 0.1,
            deepcycle: 0.1,
            aihtdd: 0.1,
            supernova: 0.2,
            trader_x: 0.2,
            phapsu_ai: 0.3,
            thanluc_ai: 0.5
        };

        let taiScore = 0;
        let xiuScore = 0;
        const allPredictions = [
            { pred: trendPred, weight: baseWeights.trend * modelScores.trend, model: 'trend' },
            { pred: shortPred, weight: baseWeights.short * modelScores.short, model: 'short' },
            { pred: meanPred, weight: baseWeights.mean * modelScores.mean, model: 'mean' },
            { pred: switchPred, weight: baseWeights.switch * modelScores.switch, model: 'switch' },
            { pred: bridgePred.prediction, weight: baseWeights.bridge * modelScores.bridge, model: 'bridge' },
            { pred: aiVannhatPred.prediction, weight: baseWeights.vannhat * modelScores.vannhat, model: 'vannhat' },
            { pred: deepCyclePred.prediction, weight: baseWeights.deepcycle * modelScores.deepcycle, model: 'deepcycle' },
            { pred: aiHtddPred.prediction, weight: baseWeights.aihtdd * modelScores.aihtdd, model: 'aihtdd' },
            { pred: supernovaPred.prediction, weight: baseWeights.supernova * modelScores.supernova, model: 'supernova' },
            { pred: traderXPred.prediction, weight: baseWeights.trader_x * modelScores.trader_x, model: 'trader_x' },
            { pred: phapsuPred.prediction, weight: baseWeights.phapsu_ai * modelScores.phapsu_ai, model: 'phapsu_ai' },
            { pred: thanlucPred.prediction, weight: baseWeights.thanluc_ai * modelScores.thanluc_ai, model: 'thanluc_ai' }
        ].filter(p => p.pred !== 'Chờ đợi');

        const taiConsensus = allPredictions.filter(p => p.pred === 'Tài').length;
        const xiuConsensus = allPredictions.filter(p => p.pred === 'Xỉu').length;

        allPredictions.forEach(p => {
            if (p.pred === 'Tài') taiScore += p.weight;
            else if (p.pred === 'Xỉu') xiuScore += p.weight;
        });

        // Apply consensus bonuses
        if (taiConsensus >= 6) {
            taiScore += 0.5;
        }
        if (xiuConsensus >= 6) {
            xiuScore += 0.5;
        }

        // Apply special model combination bonuses
        const dominantModels = [traderXPred, supernovaPred, phapsuPred, thanlucPred].filter(p => p.prediction !== 'Chờ đợi');
        if (dominantModels.length === 4 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            if (dominantModels[0].prediction === 'Tài') taiScore *= 4;
            else xiuScore *= 4;
        } else if (dominantModels.length === 3 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            if (dominantModels[0].prediction === 'Tài') taiScore *= 3;
            else xiuScore *= 3;
        } else if (traderXPred.prediction !== 'Chờ đợi' && traderXPred.prediction === supernovaPred.prediction) {
            if (traderXPred.prediction === 'Tài') taiScore *= 2;
            else xiuScore *= 2;
        }

        // Penalty for "bad patterns"
        if (this.isBadPattern(history)) {
            taiScore *= 0.5;
            xiuScore *= 0.5;
        }

        // Boost score for bridge break predictions
        if (bridgePred.breakProb > 0.6) {
            if (bridgePred.prediction === 'Tài') taiScore += 0.3;
            else if (bridgePred.prediction === 'Xỉu') xiuScore += 0.3;
        }

        const totalScore = taiScore + xiuScore;
        let finalPrediction = "Chờ đợi";
        let finalScore = 0;
        let confidence = 0;
        let explanations = [];

        if (taiScore > xiuScore) {
            finalPrediction = 'Tài';
            finalScore = taiScore;
        } else if (xiuScore > taiScore) {
            finalPrediction = 'Xỉu';
            finalScore = xiuScore;
        } else {
            explanations.push("The algorithms are in conflict or no clear signal.");
            return this.buildResult("Chờ đợi", 35, explanations.join(" | "), "Unstable market", "Medium risk");
        }

        confidence = (finalScore / totalScore) * 100;
        confidence = Math.min(99.99, Math.max(10, confidence));

        // Adjust confidence based on history length
        if (historyLength < 50) {
            confidence = Math.min(confidence, 30);
        } else if (historyLength < 200) {
            confidence = Math.min(confidence, 60);
        }

        const predictionLog = {
            session: currentIndex + 1,
            prediction: finalPrediction,
            confidence: confidence,
            models: allPredictions.map(p => ({ model: p.model, pred: p.pred, weight: p.weight.toFixed(2) }))
        };

        explanations.push(thanlucPred.reason);
        explanations.push(phapsuPred.reason);
        explanations.push(traderXPred.reason);
        explanations.push(supernovaPred.reason);
        explanations.push(aiVannhatPred.reason);
        explanations.push(bridgePred.reason);
        if (deepCyclePred.prediction !== 'Chờ đợi') {
            explanations.push(deepCyclePred.reason);
        }

        const mostInfluentialModel = allPredictions.sort((a, b) => b.weight - a.weight)[0];
        if (mostInfluentialModel) {
            explanations.push(`Most influential model: ${mostInfluentialModel.model} with weight ${mostInfluentialModel.weight.toFixed(2)}.`);
        }

        let status = "Normal";
        if (historyLength < 50) {
            status = "Very high risk";
        } else if (historyLength < 200) {
            status = "High risk";
        } else if (dominantModels.length === 4 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            status = "Divine Power - Infinite";
        } else if (dominantModels.length === 3 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            status = "Divine Power - Absolute";
        } else if (confidence > 99) {
            status = "Auto Win - ULTIMATE";
        } else if (confidence > 95) {
            status = "Top Secret - Supernova";
        } else if (confidence > 90) {
            status = "Super VIP";
        } else if (confidence > 80) {
            status = "Absolute";
        }

        return this.buildResult(finalPrediction, confidence, explanations.join(" | "), "Composite", status);
    }
}

const historyManager = new HistoricalDataManager(5000);
const predictionEngine = new PredictionEngine(historyManager);

// Refactored API route with better error handling and null checks
app.get('/api/vannhat/predict', async (req, res) => {
    let predictionResult = null;
    const now = new Date().toISOString();

    // Attempt to load from cache
    const cachedHistoricalData = historicalDataCache.get("full_history");
    if (cachedHistoricalData && Array.isArray(cachedHistoricalData)) {
        historyManager.history = cachedHistoricalData;
        // console.log("Loaded history from cache.");
    }

    try {
        const response = await axios.get(NEW_API_URL, { timeout: 8000 });
        const allHistory = response.data;

        if (allHistory && Array.isArray(allHistory) && allHistory.length > 0) {
            // Add all historical data to the manager to ensure it's up-to-date
            allHistory.reverse().forEach(item => {
                historyManager.addSession({
                    session: item.phien_truoc,
                    dice: item.xuc_xac,
                    total: item.tong,
                    result: item.ket_qua
                });
            });

            // Update cache with the latest data
            historicalDataCache.set("full_history", historyManager.getHistory());
        }
    } catch (error) {
        console.error("Error fetching data from external API:", error.message);
        // Continue using cached data if API call fails
    } finally {
        const history = historyManager.getHistory();
        const lastSession = history.length > 0 ? history[history.length - 1] : null;

        if (history.length >= 5) {
            predictionResult = predictionEngine.predict();
        } else {
            predictionResult = {
                du_doan: "Chờ đợi",
                do_tin_cay: 10,
                giai_thich: `History too short to analyze. Need at least 5 sessions. Current sessions: ${history.length}.`,
                pattern_nhan_dien: "Not enough data",
                status_phan_tich: "Very high risk"
            };
        }

        // Construct the response object with null-safe access
        const responseData = {
            id: "Tele:@CsTool001",
            thoi_gian_cap_nhat: now,
            phien: lastSession?.session ?? null,
            ket_qua: lastSession?.result ?? null,
            xuc_xac: lastSession?.dice ?? [],
            tong: lastSession?.total ?? null,
            phien_sau: lastSession?.session ? lastSession.session + 1 : null,
            du_doan: predictionResult?.du_doan ?? "Chờ đợi",
            do_tin_cay: predictionResult?.do_tin_cay ?? 10,
            giai_thich: predictionResult?.giai_thich ?? "Không có dữ liệu để phân tích.",
            pattern_nhan_dien: predictionResult?.pattern_nhan_dien ?? "Không đủ dữ liệu",
            status_phan_tich: predictionResult?.status_phan_tich ?? "Rủi ro cao"
        };

        // Add a note if the prediction was based on cached data
        if (!history.length || (responseData.phien === null && responseData.phien_sau === null)) {
            responseData.giai_thich = `(Cached data) ${responseData.giai_thich}`;
            responseData.status_phan_tich = "Rủi ro cao (cache)";
        }

        res.json(responseData);
    }
});


app.get('/', (req, res) => {
    res.send('Welcome to the Prediction API. For tool inquiries, please contact @CsTool001 on Telegram.');
});

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
