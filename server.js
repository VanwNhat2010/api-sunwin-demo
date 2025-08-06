const express = require('express');
const axios = require('axios');
const NodeCache = require('node-cache');
const app = express();
const PORT = process.env.PORT || 3000;

const historicalDataCache = new NodeCache({ stdTTL: 1800, checkperiod: 60 });
const SUNWIN_API_URL = 'https://binhtool90-sunwin-predict.onrender.com/api/taixiu/sunwin';

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

class HistoricalDataManager {
    constructor(maxHistoryLength = 5000) {
        this.history = [];
        this.maxHistoryLength = maxHistoryLength;
    }

    addSession(newData) {
        if (!newData || !newData.phien) return false;
        if (this.history.some(item => item.phien === newData.phien)) return false;
        this.history.push(newData);
        if (this.history.length > this.maxHistoryLength) {
            this.history = this.history.slice(this.history.length - this.maxHistoryLength);
        }
        this.history.sort((a, b) => a.phien - b.phien);
        return true;
    }

    getHistory() {
        return [...this.history];
    }
}

class PredictionEngine {
    constructor(historyMgr) {
        this.historyMgr = historyMgr;
        this.mlModel = null;
        this.deepLearningModel = null;
        this.divineModel = null;
        this.trainModels();
    }

    trainModels() {
        console.log("Đang khởi tạo và huấn luyện các mô hình AI...");
        const history = this.historyMgr.getHistory();
        if (history.length < 500) {
            this.mlModel = null;
            this.deepLearningModel = null;
            this.divineModel = null;
            return;
        }

        const taiData = history.filter(h => h.ket_qua === 'Tài');
        const xiuData = history.filter(h => h.ket_qua === 'Xỉu');

        const taiFreq = taiData.length / history.length;
        const xiuFreq = xiuData.length / history.length;
        
        const taiStreakAvg = taiData.reduce((sum, h, i) => {
            if (i > 0 && taiData[i-1].phien === h.phien - 1) return sum + 1;
            return sum;
        }, 0) / taiData.length;

        const xiuStreakAvg = xiuData.reduce((sum, h, i) => {
            if (i > 0 && xiuData[i-1].phien === h.phien - 1) return sum + 1;
            return sum;
        }, 0) / xiuData.length;
        
        this.mlModel = { taiFreq, xiuFreq, taiStreakAvg, xiuStreakAvg };
        
        const last100 = history.slice(-100);
        const last100Results = last100.map(h => h.ket_qua);
        const last100Scores = last100.map(h => h.tong || 0);
        this.deepLearningModel = {
            taiDominance: last100Results.filter(r => r === 'Tài').length > last100.length * 0.6,
            xiuDominance: last100Results.filter(r => r === 'Xỉu').length > last100.length * 0.6,
            highVariance: last100Scores.some(score => score > 14 || score < 6)
        };
        
        const last200 = history.slice(-200);
        const uniquePatterns = {};
        for(let i = 0; i < last200.length - 5; i++){
            const pattern = last200.slice(i, i+5).map(h => h.ket_qua).join(',');
            uniquePatterns[pattern] = (uniquePatterns[pattern] || 0) + 1;
        }
        const commonPattern = Object.entries(uniquePatterns).filter(([p, count]) => count > 1);
        this.divineModel = {
            hasRepeatedPattern: commonPattern.length > 0,
            mostCommonPattern: commonPattern[0]?.[0]
        };

        console.log("Huấn luyện các mô hình AI hoàn tất.");
    }

    traderX(history) {
        if (!this.mlModel || history.length < 500) {
            return { prediction: 'Chờ đợi', reason: 'Chưa đủ dữ liệu để huấn luyện Trader X' };
        }
        const last10 = history.slice(-10).map(h => h.ket_qua);
        const currentStreak = this.detectStreakAndBreak(history).streak;
        const taiInLast10 = last10.filter(r => r === 'Tài').length;
        const xiuInLast10 = last10.filter(r => r === 'Xỉu').length;
        if (taiInLast10 / 10 > this.mlModel.taiFreq * 1.5 && currentStreak >= this.mlModel.taiStreakAvg + 1) {
            return { prediction: 'Xỉu', reason: '[TRADER X] Mẫu Tài đang quá mức trung bình, dự đoán đảo chiều Xỉu' };
        }
        if (xiuInLast10 / 10 > this.mlModel.xiuFreq * 1.5 && currentStreak >= this.mlModel.xiuStreakAvg + 1) {
            return { prediction: 'Tài', reason: '[TRADER X] Mẫu Xỉu đang quá mức trung bình, dự đoán đảo chiều Tài' };
        }
        return { prediction: 'Chờ đợi', reason: '[TRADER X] Không phát hiện mẫu đặc biệt từ Học máy' };
    }

    phapsuAI(history) {
        if (!this.deepLearningModel || history.length < 500) {
            return { prediction: 'Chờ đợi', reason: 'Chưa đủ dữ liệu để kích hoạt Pháp Sư AI' };
        }
        const last3 = history.slice(-3).map(h => h.ket_qua);
        const last5Scores = history.slice(-5).map(h => h.tong || 0);
        const avgScore = last5Scores.reduce((sum, score) => sum + score, 0) / last5Scores.length;
        if (this.deepLearningModel.taiDominance && last3.join(',') === 'Tài,Tài,Tài') {
            return { prediction: 'Xỉu', reason: '[PHÁP SƯ AI] Phát hiện lỗi liên tiếp 3 Tài trong chu kỳ Tài thống trị, dự đoán bẻ cầu' };
        }
        if (this.deepLearningModel.xiuDominance && last3.join(',') === 'Xỉu,Xỉu,Xỉu') {
            return { prediction: 'Tài', reason: '[PHÁP SƯ AI] Phát hiện lỗi liên tiếp 3 Xỉu trong chu kỳ Xỉu thống trị, dự đoán bẻ cầu' };
        }
        if (this.deepLearningModel.highVariance && avgScore > 13) {
            return { prediction: 'Xỉu', reason: '[PHÁP SƯ AI] Phát hiện lỗi điểm số cao bất thường trong chu kỳ biến động lớn' };
        }
        if (this.deepLearningModel.highVariance && avgScore < 7) {
            return { prediction: 'Tài', reason: '[PHÁP SƯ AI] Phát hiện lỗi điểm số thấp bất thường trong chu kỳ biến động lớn' };
        }
        return { prediction: 'Chờ đợi', reason: '[PHÁP SƯ AI] Không tìm thấy lỗi hệ thống' };
    }

    thanlucAI(history) {
        if (!this.divineModel || history.length < 500) {
            return { prediction: 'Chờ đợi', reason: 'Chưa đủ dữ liệu để kích hoạt Thần Lực AI' };
        }
        const { streak, currentResult } = this.detectStreakAndBreak(history);
        const last5 = history.slice(-5).map(h => h.ket_qua).join(',');

        if(this.divineModel.hasRepeatedPattern && this.divineModel.mostCommonPattern === last5) {
             const patternArray = this.divineModel.mostCommonPattern.split(',');
             const nextPred = patternArray.length > 0 ? (patternArray[patternArray.length-1] === 'Tài' ? 'Xỉu' : 'Tài') : 'Chờ đợi';
             return { prediction: nextPred, reason: `[THẦN LỰC AI] Phát hiện chuỗi lặp ${last5} → dự đoán đảo chiều`, source: 'THẦN LỰC' };
        }
        if (streak >= 7) {
            return { prediction: currentResult === 'Tài' ? 'Xỉu' : 'Tài', reason: `[THẦN LỰC AI] Chuỗi ${currentResult} kéo dài quá giới hạn ${streak} lần, chắc chắn bẻ cầu!`, source: 'THẦN LỰC' };
        }
        return { prediction: 'Chờ đợi', reason: '[THẦN LỰC AI] Không phát hiện tín hiệu siêu nhiên', source: 'THẦN LỰC' };
    }

    detectStreakAndBreak(history) {
        if (!history || history.length === 0) return { streak: 0, currentResult: null, breakProb: 0.0 };
        let streak = 1;
        const currentResult = history[history.length - 1].ket_qua;
        for (let i = history.length - 2; i >= 0; i--) {
            if (history[i].ket_qua === currentResult) {
                streak++;
            } else {
                break;
            }
        }
        const last15 = history.slice(-15).map(h => h.ket_qua);
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

    evaluateModelPerformance(history, modelName, lookback = 10) {
        if (!modelPredictions[modelName] || history.length < 2) return 1.0;
        lookback = Math.min(lookback, history.length - 1);
        let correctCount = 0;
        for (let i = 0; i < lookback; i++) {
            const historyIndex = history.length - (i + 2);
            const pred = modelPredictions[modelName][history[historyIndex].phien];
            const actual = history[history.length - (i + 1)].ket_qua;
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
        if (historyLength < 100) return { prediction: 'Chờ đợi', reason: 'Không đủ dữ liệu cho Supernova AI', source: 'SUPERNOVA' };
        const last30Scores = history.slice(-30).map(h => h.tong || 0);
        const avgScore = last30Scores.reduce((sum, score) => sum + score, 0) / 30;
        const scoreStdDev = Math.sqrt(last30Scores.map(x => Math.pow(x - avgScore, 2)).reduce((a, b) => a + b) / 30);
        const lastScore = last30Scores[last30Scores.length - 1];
        if (lastScore > avgScore + scoreStdDev * 2) {
            return { prediction: 'Xỉu', reason: `[SUPERNOVA] Điểm số gần đây (${lastScore}) quá cao so với trung bình, dự đoán đảo chiều`, source: 'SUPERNOVA' };
        }
        if (lastScore < avgScore - scoreStdDev * 2) {
            return { prediction: 'Tài', reason: `[SUPERNOVA] Điểm số gần đây (${lastScore}) quá thấp so với trung bình, dự đoán đảo chiều`, source: 'SUPERNOVA' };
        }
        const last6 = history.slice(-6).map(h => h.ket_qua);
        if (last6.join(',') === 'Tài,Xỉu,Tài,Xỉu,Tài,Xỉu' || last6.join(',') === 'Xỉu,Tài,Xỉu,Tài,Xỉu,Tài') {
            const nextPred = last6[last6.length - 1] === 'Tài' ? 'Xỉu' : 'Tài';
            return { prediction: nextPred, reason: `[SUPERNOVA] Phát hiện cầu 1-1 dài hạn, dự đoán theo mẫu`, source: 'SUPERNOVA' };
        }
        return { prediction: 'Chờ đợi', reason: '[SUPERNOVA] Không phát hiện tín hiệu siêu chuẩn', source: 'SUPERNOVA' };
    }
    
    deepCycleAI(history) {
        const historyLength = history.length;
        if (historyLength < 50) return { prediction: 'Chờ đợi', reason: 'Không đủ dữ liệu cho DeepCycleAI' };
        const last50 = history.slice(-50).map(h => h.ket_qua);
        const last15 = history.slice(-15).map(h => h.ket_qua);
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
            return { prediction: 'Xỉu', reason: '[DeepCycleAI] Chu kỳ Tài đang đạt đỉnh, dự đoán đảo chiều về Xỉu.' };
        }
        if (currentXiuCount > avgXiu + 3) {
            return { prediction: 'Tài', reason: '[DeepCycleAI] Chu kỳ Xỉu đang đạt đỉnh, dự đoán đảo chiều về Tài.' };
        }
        return { prediction: 'Chờ đợi', reason: '[DeepCycleAI] Không phát hiện chu kỳ rõ ràng.' };
    }

    aihtddLogic(history) {
        if (!history || history.length < 3) {
            return { prediction: 'Chờ đợi', reason: '[AI VANNHAT] Không đủ lịch sử để phân tích chuyên sâu', source: 'AI VANNHAT' };
        }
        const last5Results = history.slice(-5).map(item => item.ket_qua);
        const last5Scores = history.slice(-5).map(item => item.tong || 0);
        const taiCount = last5Results.filter(result => result === 'Tài').length;
        const xiuCount = last5Results.filter(result => result === 'Xỉu').length;
        if (history.length >= 3) {
            const last3Results = history.slice(-3).map(item => item.ket_qua);
            if (last3Results.join(',') === 'Tài,Xỉu,Tài') {
                return { prediction: 'Xỉu', reason: '[AI VANNHAT] Phát hiện mẫu 1T1X → nên đánh Xỉu', source: 'AI VANNHAT' };
            } else if (last3Results.join(',') === 'Xỉu,Tài,Xỉu') {
                return { prediction: 'Tài', reason: '[AI VANNHAT] Phát hiện mẫu 1X1T → nên đánh Tài', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 4) {
            const last4Results = history.slice(-4).map(item => item.ket_qua);
            if (last4Results.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
                return { prediction: 'Tài', reason: '[AI VANNHAT] Phát hiện mẫu 2T2X → nên đánh Tài', source: 'AI VANNHAT' };
            } else if (last4Results.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
                return { prediction: 'Xỉu', reason: '[AI VANNHAT] Phát hiện mẫu 2X2T → nên đánh Xỉu', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 9 && history.slice(-6).every(item => item.ket_qua === 'Tài')) {
            return { prediction: 'Xỉu', reason: '[AI VANNHAT] Chuỗi Tài quá dài (6 lần) → dự đoán Xỉu', source: 'AI VANNHAT' };
        } else if (history.length >= 9 && history.slice(-6).every(item => item.ket_qua === 'Xỉu')) {
            return { prediction: 'Tài', reason: '[AI VANNHAT] Chuỗi Xỉu quá dài (6 lần) → dự đoán Tài', source: 'AI VANNHAT' };
        }
        const avgScore = last5Scores.reduce((sum, score) => sum + score, 0) / (last5Scores.length || 1);
        if (avgScore > 10) {
            return { prediction: 'Tài', reason: `[AI VANNHAT] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'AI VANNHAT' };
        } else if (avgScore < 8) {
            return { prediction: 'Xỉu', reason: `[AI VANNHAT] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'AI VANNHAT' };
        }
        if (taiCount > xiuCount + 1) {
            return { prediction: 'Xỉu', reason: `[AI VANNHAT] Tài chiếm đa số (${taiCount}/${last5Results.length}) → dự đoán Xỉu`, source: 'AI VANNHAT' };
        } else if (xiuCount > taiCount + 1) {
            return { prediction: 'Tài', reason: `[AI VANNHAT] Xỉu chiếm đa số (${xiuCount}/${last5Results.length}) → dự đoán Tài`, source: 'AI VANNHAT' };
        } else {
            const overallTai = history.filter(h => h.ket_qua === 'Tài').length;
            const overallXiu = history.filter(h => h.ket_qua === 'Xỉu').length;
            if (overallTai > overallXiu) {
                return { prediction: 'Xỉu', reason: '[Bẻ Cầu Thông Minh] Tổng thể Tài nhiều hơn → dự đoán Xỉu', source: 'AI VANNHAT' };
            } else {
                return { prediction: 'Tài', reason: '[Theo Cầu Thông Minh] Tổng thể Xỉu nhiều hơn hoặc bằng → dự đoán Tài', source: 'AI VANNHAT' };
            }
        }
    }

    smartBridgeBreak(history) {
        if (!history || history.length < 5) return { prediction: 'Chờ đợi', breakProb: 0.0, reason: 'Không đủ dữ liệu để theo/bẻ cầu' };
        const { streak, currentResult, breakProb } = this.detectStreakAndBreak(history);
        const last20 = history.slice(-20).map(h => h.ket_qua);
        const lastScores = history.slice(-20).map(h => h.tong || 0);
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
            reason = `[Theo Cầu Thông Minh] Chuỗi ${streak} ${currentResult} ổn định, tiếp tục theo cầu`;
        } else if (streak >= 6) {
            breakProbability = Math.min(breakProbability + 0.3, 0.95);
            reason = `[Bẻ Cầu Thông Minh] Chuỗi ${streak} ${currentResult} quá dài, khả năng bẻ cầu cao`;
        } else if (streak >= 3 && scoreDeviation > 3.5) {
            breakProbability = Math.min(breakProbability + 0.25, 0.9);
            reason = `[Bẻ Cầu Thông Minh] Biến động điểm số lớn (${scoreDeviation.toFixed(1)}), khả năng bẻ cầu tăng`;
        } else if (isStablePattern && last5.every(r => r === currentResult)) {
            breakProbability = Math.min(breakProbability + 0.2, 0.85);
            reason = `[Bẻ Cầu Thông Minh] Phát hiện mẫu lặp ${mostCommonPattern[0]}, có khả năng bẻ cầu`;
        } else {
            breakProbability = Math.max(breakProbability - 0.2, 0.1);
            reason = `[Theo Cầu Thông Minh] Không phát hiện mẫu bẻ mạnh, tiếp tục theo cầu`;
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
        const last15 = history.slice(-15).map(h => h.ket_qua);
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
        const last8 = history.slice(-8).map(h => h.ket_qua);
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
        const last12 = history.slice(-12).map(h => h.ket_qua);
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
        const last10 = history.slice(-10).map(h => h.ket_qua);
        if (!last10.length) return 'Chờ đợi';
        const switches = last10.slice(1).reduce((count, curr, idx) => count + (curr !== last10[idx] ? 1 : 0), 0);
        return switches >= 4 ? (last10[last10.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu') : (last10[last10.length - 1] === 'Xỉu' ? 'Tài' : 'Xỉu');
    }

    isBadPattern(history) {
        const last15 = history.slice(-15).map(h => h.ket_qua);
        if (!last15.length) return false;
        const switches = last15.slice(1).reduce((count, curr, idx) => count + (curr !== last15[idx] ? 1 : 0), 0);
        const { streak } = this.detectStreakAndBreak(history);
        return switches >= 6 || streak >= 7;
    }

    aiVannhatLogic(history) {
        const recentHistory = history.slice(-5).map(h => h.ket_qua);
        const recentScores = history.slice(-5).map(h => h.tong || 0);
        const taiCount = recentHistory.filter(r => r === 'Tài').length;
        const xiuCount = recentHistory.filter(r => r === 'Xỉu').length;
        const { streak, currentResult } = this.detectStreakAndBreak(history);
        if (streak >= 2 && streak <= 4) {
            return { prediction: currentResult, reason: `[Theo Cầu Thông Minh] Chuỗi ngắn ${streak} ${currentResult}, tiếp tục theo cầu`, source: 'AI VANNHAT' };
        }
        if (history.length >= 3) {
            const last3 = history.slice(-3).map(h => h.ket_qua);
            if (last3.join(',') === 'Tài,Xỉu,Tài') {
                return { prediction: 'Xỉu', reason: '[Bẻ Cầu Thông Minh] Phát hiện mẫu 1T1X → tiếp theo nên đánh Xỉu', source: 'AI VANNHAT' };
            } else if (last3.join(',') === 'Xỉu,Tài,Xỉu') {
                return { prediction: 'Tài', reason: '[Bẻ Cầu Thông Minh] Phát hiện mẫu 1X1T → tiếp theo nên đánh Tài', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 4) {
            const last4 = history.slice(-4).map(h => h.ket_qua);
            if (last4.join(',') === 'Tài,Tài,Xỉu,Xỉu') {
                return { prediction: 'Tài', reason: '[Theo Cầu Thông Minh] Phát hiện mẫu 2T2X → tiếp theo nên đánh Tài', source: 'AI VANNHAT' };
            } else if (last4.join(',') === 'Xỉu,Xỉu,Tài,Tài') {
                return { prediction: 'Xỉu', reason: '[Theo Cầu Thông Minh] Phát hiện mẫu 2X2T → tiếp theo nên đánh Xỉu', source: 'AI VANNHAT' };
            }
        }
        if (history.length >= 7 && history.slice(-7).every(h => h.ket_qua === 'Xỉu')) {
            return { prediction: 'Tài', reason: '[Bẻ Cầu Thông Minh] Chuỗi Xỉu quá dài (7 lần) → dự đoán Tài', source: 'AI VANNHAT' };
        } else if (history.length >= 7 && history.slice(-7).every(h => h.ket_qua === 'Tài')) {
            return { prediction: 'Xỉu', reason: '[Bẻ Cầu Thông Minh] Chuỗi Tài quá dài (7 lần) → dự đoán Xỉu', source: 'AI VANNHAT' };
        }
        const avgScore = recentScores.reduce((sum, score) => sum + score, 0) / (recentScores.length || 1);
        if (avgScore > 11) {
            return { prediction: 'Tài', reason: `[Theo Cầu Thông Minh] Điểm trung bình cao (${avgScore.toFixed(1)}) → dự đoán Tài`, source: 'AI VANNHAT' };
        } else if (avgScore < 7) {
            return { prediction: 'Xỉu', reason: `[Theo Cầu Thông Minh] Điểm trung bình thấp (${avgScore.toFixed(1)}) → dự đoán Xỉu`, source: 'AI VANNHAT' };
        }
        if (taiCount > xiuCount + 1) {
            return { prediction: 'Xỉu', reason: `[Bẻ Cầu Thông Minh] Tài chiếm đa số (${taiCount}/${recentHistory.length}) → dự đoán Xỉu`, source: 'AI VANNHAT' };
        } else if (xiuCount > taiCount + 1) {
            return { prediction: 'Tài', reason: `[Bẻ Cầu Thông Minh] Xỉu chiếm đa số (${xiuCount}/${recentHistory.length}) → dự đoán Tài`, source: 'AI VANNHAT' };
        } else {
            const overallTai = history.filter(h => h.ket_qua === 'Tài').length;
            const overallXiu = history.filter(h => h.ket_qua === 'Xỉu').length;
            if (overallTai > overallXiu) {
                return { prediction: 'Xỉu', reason: '[Bẻ Cầu Thông Minh] Tổng thể Tài nhiều hơn → dự đoán Xỉu', source: 'AI VANNHAT' };
            } else {
                return { prediction: 'Tài', reason: '[Theo Cầu Thông Minh] Tổng thể Xỉu nhiều hơn hoặc bằng → dự đoán Tài', source: 'AI VANNHAT' };
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

    predict() {
        const history = this.historyMgr.getHistory();
        const historyLength = history.length;
        
        if (historyLength < 500) {
            return this.buildResult("Chờ đợi", 10, 'Không đủ lịch sử để phân tích chuyên sâu. Vui lòng chờ thêm.', 'Chưa đủ dữ liệu', 'Rủi ro cao');
        }

        this.trainModels();

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

        const currentIndex = history[history.length - 1].phien;
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
            { pred: trendPred.prediction, weight: baseWeights.trend * modelScores.trend, model: 'trend' },
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

        if (taiConsensus >= 6) {
            taiScore += 0.5;
        }
        if (xiuConsensus >= 6) {
            xiuScore += 0.5;
        }
        
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

        if (this.isBadPattern(history)) {
            taiScore *= 0.5;
            xiuScore *= 0.5;
        }

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
            explanations.push("Các thuật toán đang mâu thuẫn hoặc không có tín hiệu rõ ràng.");
            return this.buildResult("Chờ đợi", 35, explanations.join(" | "), "Thị trường không ổn định", "Rủi ro trung bình");
        }

        confidence = (finalScore / totalScore) * 100;
        confidence = Math.min(99.99, Math.max(10, confidence));

        const predictionLog = {
            phien: currentIndex + 1,
            du_doan: finalPrediction,
            do_tin_cay: confidence,
            models: allPredictions.map(p => ({ model: p.model, pred: p.pred, weight: p.weight.toFixed(2) }))
        };
        console.log(`[LOG DỰ ĐOÁN] ${JSON.stringify(predictionLog)}`);

        explanations.push(thanlucPred.reason);
        explanations.push(phapsuPred.reason);
        explanations.push(traderXPred.reason);
        explanations.push(supernovaPred.reason);
        explanations.push(aiVannhatPred.reason);
        explanations.push(bridgePred.reason);
        if (deepCyclePred.prediction !== 'Chờ đợi') {
            explanations.push(deepCyclePred.reason);
        }
        
        const mostInfluentialModel = allPredictions.sort((a,b) => b.weight - a.weight)[0];
        if (mostInfluentialModel) {
            explanations.push(`Mô hình mạnh nhất: ${mostInfluentialModel.model} với trọng số ${mostInfluentialModel.weight.toFixed(2)}.`);
        }

        let status = "Cao";
        if (dominantModels.length === 4 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            status = "Thần Lực - Vô Hạn";
        } else if (dominantModels.length === 3 && dominantModels.every(p => p.prediction === dominantModels[0].prediction)) {
            status = "Thần Lực - Tuyệt đối";
        } else if (confidence > 99) {
            status = "Auto Win - CỰC PHẨM";
        } else if (confidence > 95) {
            status = "Tuyệt Mật - Supernova";
        } else if (confidence > 90) {
            status = "Siêu VIP";
        } else if (confidence > 80) {
            status = "Tuyệt đối";
        }
        
        return this.buildResult(finalPrediction, confidence, explanations.join(" | "), "Tổng hợp", status);
    }
}

const historyManager = new HistoricalDataManager(5000);
const predictionEngine = new PredictionEngine(historyManager);

app.get('/api/sunwin/predict', async (req, res) => {
    let currentData = null;
    let cachedHistoricalData = historicalDataCache.get("full_history");

    if (cachedHistoricalData) {
        historyManager.history = cachedHistoricalData;
    }

    try {
        const response = await axios.get(SUNWIN_API_URL, { timeout: 8000 });
        currentData = response.data;

        if (currentData && currentData.phien && currentData.ket_qua) {
            historyManager.addSession(currentData);
            historicalDataCache.set("full_history", historyManager.getHistory());
        }

        const predictionResult = predictionEngine.predict();

        const result = {
            id: "Tele:@CsTool001",
            thoi_gian_cap_nhat: new Date().toISOString(),
            phien: currentData ? currentData.phien : (historyManager.getHistory().length > 0 ? historyManager.getHistory().slice(-1)[0].phien : null),
            ket_qua: currentData ? currentData.ket_qua : null,
            xuc_xac: currentData ? [currentData.xuc_xac_1, currentData.xuc_xac_2, currentData.xuc_xac_3] : [],
            tong: currentData ? currentData.tong : null,
            phien_sau: currentData ? currentData.phien + 1 : (historyManager.getHistory().length > 0 ? historyManager.getHistory().slice(-1)[0].phien + 1 : null),
            du_doan: predictionResult.du_doan,
            do_tin_cay: predictionResult.do_tin_cay,
            giai_thich: predictionResult.giai_thich,
            pattern_nhan_dien: predictionResult.pattern_nhan_dien,
            status_phan_tich: predictionResult.status_phan_tich,
            tong_so_phien_da_phan_tich: historyManager.getHistory().length
        };

        res.json(result);

    } catch (error) {
        console.error("Lỗi khi gọi API hoặc xử lý dữ liệu:", error.message);
        if (historyManager.getHistory().length >= 500) {
            const predictionResult = predictionEngine.predict();
            res.status(200).json({
                id: "Tele:@CsTool001",
                thoi_gian_nhan_loi: new Date().toISOString(),
                error_from_api: "Không thể lấy dữ liệu phiên hiện tại. Sử dụng dữ liệu lịch sử cached.",
                phien: historyManager.getHistory().slice(-1)[0].phien,
                ket_qua: historyManager.getHistory().slice(-1)[0].ket_qua,
                phien_sau: historyManager.getHistory().slice(-1)[0].phien + 1,
                du_doan: predictionResult.du_doan,
                do_tin_cay: predictionResult.do_tin_cay,
                giai_thich: `(Dữ liệu cũ) ${predictionResult.giai_thich}`,
                pattern_nhan_dien: predictionResult.pattern_nhan_dien,
                status_phan_tich: "Rủi ro trung bình (cache)",
                tong_so_phien_da_phan_tich: historyManager.getHistory().length
            });
        } else {
             res.status(500).json({
                id: "Tele:@CsTool001",
                thoi_gian_nhan_loi: new Date().toISOString(),
                error: "Không thể lấy dữ liệu từ API gốc và không có đủ lịch sử để phân tích.",
                du_doan: "Không thể dự đoán",
                do_tin_cay: 0,
                giai_thich: "Lỗi hệ thống. Không có dữ liệu để phân tích.",
                pattern_nhan_dien: "Lỗi hệ thống",
                status_phan_tich: "Lỗi",
                tong_so_phien_da_phan_tich: 0
            });
        }
    }
});

app.get('/', (req, res) => {
    res.send('CHÀO CON CHÓ : MUA TOOL IB @CsTool001');
});

app.listen(PORT, () => {
    console.log(`Server đang chạy trên cổng ${PORT}`);
});
