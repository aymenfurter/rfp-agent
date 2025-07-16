class CompetitiveStorage {
    constructor() {
        this.storageKey = 'competitiveAnalyses';
    }

    saveAnalysis(analysisData, metadata = {}) {
        try {
            const analyses = this.getStoredAnalyses();
            const analysisId = this.generateAnalysisId();
            
            const analysis = {
                id: analysisId,
                timestamp: new Date().toISOString(),
                productName: window.currentProductName || 'Unknown Product',
                analysisData: analysisData,
                ...metadata
            };
            
            analyses.push(analysis);
            localStorage.setItem(this.storageKey, JSON.stringify(analyses));
            
            return analysisId;
        } catch (error) {
            console.error('Failed to save analysis:', error);
            throw new Error('Failed to save analysis to storage');
        }
    }

    loadAnalysis(analysisId) {
        try {
            const analyses = this.getStoredAnalyses();
            return analyses.find(analysis => analysis.id === analysisId);
        } catch (error) {
            console.error('Failed to load analysis:', error);
            return null;
        }
    }

    deleteAnalysis(analysisId) {
        try {
            const analyses = this.getStoredAnalyses();
            const filteredAnalyses = analyses.filter(analysis => analysis.id !== analysisId);
            localStorage.setItem(this.storageKey, JSON.stringify(filteredAnalyses));
            return true;
        } catch (error) {
            console.error('Failed to delete analysis:', error);
            throw new Error('Failed to delete analysis from storage');
        }
    }

    getStoredAnalyses() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Failed to get stored analyses:', error);
            return [];
        }
    }

    clearAllAnalyses() {
        try {
            localStorage.removeItem(this.storageKey);
        } catch (error) {
            console.error('Failed to clear analyses:', error);
            throw new Error('Failed to clear stored analyses');
        }
    }

    exportAnalysis(analysisId) {
        try {
            const analysis = this.loadAnalysis(analysisId);
            if (!analysis) {
                throw new Error('Analysis not found');
            }

            const exportData = {
                ...analysis,
                exportedAt: new Date().toISOString(),
                version: '1.0'
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const dataBlob = new Blob([dataStr], { type: 'application/json' });
            
            const url = URL.createObjectURL(dataBlob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `competitive-analysis-${analysis.productName.replace(/\s+/g, '-')}-${analysisId.substr(-8)}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            
            return link.download;
        } catch (error) {
            console.error('Failed to export analysis:', error);
            throw new Error('Failed to export analysis');
        }
    }

    async importAnalysis(file) {
        try {
            const text = await this.readFileAsText(file);
            const importData = JSON.parse(text);
            
            // Validate import data
            if (!importData.analysisData || !importData.productName) {
                throw new Error('Invalid analysis file format');
            }

            // Generate new ID for imported analysis
            const newId = this.generateAnalysisId();
            const analysis = {
                ...importData,
                id: newId,
                imported: true,
                importedAt: new Date().toISOString(),
                originalId: importData.id
            };

            const analyses = this.getStoredAnalyses();
            analyses.push(analysis);
            localStorage.setItem(this.storageKey, JSON.stringify(analyses));

            return analysis;
        } catch (error) {
            console.error('Failed to import analysis:', error);
            throw new Error('Failed to import analysis: ' + error.message);
        }
    }

    getAnalysisSummary(analysis) {
        const date = new Date(analysis.timestamp).toLocaleDateString();
        const title = analysis.customName || `${analysis.productName} Analysis`;
        
        return {
            title,
            date,
            criteriaCount: analysis.criteriaCount || analysis.analysisData?.length || 0,
            advantages: analysis.advantages || 0,
            competitive: analysis.competitive || 0,
            improvements: analysis.improvements || 0,
            competitors: analysis.competitors || [],
            useDeepResearch: analysis.useDeepResearch || false
        };
    }

    generateAnalysisId() {
        return 'analysis_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = () => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }

    // Validate analysis data structure
    validateAnalysisData(data) {
        const requiredFields = ['analysisData', 'productName', 'timestamp'];
        return requiredFields.every(field => data.hasOwnProperty(field)) &&
               Array.isArray(data.analysisData) &&
               data.analysisData.length > 0;
    }
}

// Create and export global instance
export const competitiveStorage = new CompetitiveStorage();

// Make it globally available
window.competitiveStorage = competitiveStorage;
