export class DocumentGenerator {
    constructor() {
        this.productName = window.currentProductName || 'Your Solution';
        this.generatedDocuments = {};
    }

    async generateRFPResponse() {
        try {
            const validatedCriteria = window.validatedCriteria || [];
            if (validatedCriteria.length === 0) {
                throw new Error('No validated criteria available for RFP response generation');
            }

            const content = this.createRFPResponseContent(validatedCriteria);
            const filename = `RFP_Response_${this.productName.replace(/\s+/g, '_')}_${this.getDateString()}.docx`;
            
            // In a real implementation, this would generate an actual Word document
            // For now, we'll create a comprehensive text document
            this.downloadTextAsFile(content, filename);
            
            this.generatedDocuments.rfpResponse = {
                filename,
                generated: new Date(),
                content: content
            };

            return { 
                success: true, 
                filename,
                size: content.length 
            };
        } catch (error) {
            console.error('Error generating RFP response:', error);
            throw error;
        }
    }

    async generateCompetitiveAnalysis() {
        try {
            const competitiveResults = window.competitiveAnalysisResults || [];
            if (competitiveResults.length === 0) {
                throw new Error('No competitive analysis data available');
            }

            const content = this.createCompetitiveAnalysisContent(competitiveResults);
            const filename = `Competitive_Analysis_${this.productName.replace(/\s+/g, '_')}_${this.getDateString()}.docx`;
            
            this.downloadTextAsFile(content, filename);
            
            this.generatedDocuments.competitiveAnalysis = {
                filename,
                generated: new Date(),
                content: content
            };

            return { 
                success: true, 
                filename,
                size: content.length 
            };
        } catch (error) {
            console.error('Error generating competitive analysis:', error);
            throw error;
        }
    }

    async generateComplianceMatrix() {
        try {
            const validatedCriteria = window.validatedCriteria || [];
            if (validatedCriteria.length === 0) {
                throw new Error('No validated criteria available for compliance matrix');
            }

            const content = this.createComplianceMatrixContent(validatedCriteria);
            const filename = `Compliance_Matrix_${this.productName.replace(/\s+/g, '_')}_${this.getDateString()}.csv`;
            
            this.downloadTextAsFile(content, filename, 'text/csv');
            
            this.generatedDocuments.complianceMatrix = {
                filename,
                generated: new Date(),
                content: content
            };

            return { 
                success: true, 
                filename,
                size: content.length 
            };
        } catch (error) {
            console.error('Error generating compliance matrix:', error);
            throw error;
        }
    }

    createRFPResponseContent(validatedCriteria) {
        const stats = this.calculateComplianceStats(validatedCriteria);
        const currentDate = new Date().toLocaleDateString();

        return `
# RFP RESPONSE DOCUMENT
## ${this.productName}

**Generated:** ${currentDate}
**Document Version:** 1.0

---

## EXECUTIVE SUMMARY

This document provides a comprehensive response to all RFP criteria for ${this.productName}. Our analysis demonstrates strong compliance across ${stats.total} evaluated criteria, with ${stats.compliant} fully compliant responses (${Math.round((stats.compliant/stats.total)*100)}% compliance rate).

### Key Highlights:
- **Total Criteria Evaluated:** ${stats.total}
- **Fully Compliant:** ${stats.compliant} (${Math.round((stats.compliant/stats.total)*100)}%)
- **Partially Compliant:** ${stats.partial}
- **Non-Compliant:** ${stats.nonCompliant}

---

## DETAILED RESPONSES

${validatedCriteria.map((criterion, index) => this.formatCriterionResponse(criterion, index + 1)).join('\n\n')}

---

## COMPLIANCE SUMMARY

### Overall Assessment
${this.productName} demonstrates strong alignment with the RFP requirements, achieving ${Math.round((stats.compliant/stats.total)*100)}% full compliance. Our solution addresses all critical requirements while providing additional value through enhanced capabilities and comprehensive support.

### Strengths
${this.identifyStrengths(validatedCriteria).map(strength => `- ${strength}`).join('\n')}

### Implementation Approach
Our implementation strategy focuses on:
1. **Seamless Integration:** Minimizing disruption to existing workflows
2. **Scalable Architecture:** Supporting future growth and requirements
3. **Comprehensive Support:** 24/7 technical assistance and training
4. **Security First:** Enterprise-grade security and compliance

---

## NEXT STEPS

1. **Technical Deep Dive:** Schedule detailed technical discussions
2. **Proof of Concept:** Demonstrate key capabilities in your environment
3. **Implementation Planning:** Develop detailed project timeline
4. **Contract Negotiation:** Finalize terms and conditions

---

**Contact Information:**
For questions regarding this response, please contact our RFP team.

**Document End**
        `.trim();
    }

    createCompetitiveAnalysisContent(competitiveResults) {
        const currentDate = new Date().toLocaleDateString();
        const competitors = this.getUniqueCompetitors(competitiveResults);
        const stats = this.calculateCompetitiveStats(competitiveResults);

        return `
# COMPETITIVE ANALYSIS REPORT
## ${this.productName} vs Competition

**Generated:** ${currentDate}
**Analysis Version:** 1.0

---

## EXECUTIVE SUMMARY

This competitive analysis evaluates ${this.productName} against ${competitors.length} key competitors across ${competitiveResults.length} evaluation criteria. Our analysis reveals significant competitive advantages and strategic positioning opportunities.

### Key Findings:
- **Competitive Advantages:** ${stats.advantages} criteria
- **Competitive Parity:** ${stats.competitive} criteria  
- **Improvement Opportunities:** ${stats.improvements} criteria
- **Overall Competitive Score:** ${this.calculateOverallScore(competitiveResults)}%

---

## COMPETITOR OVERVIEW

${competitors.map(competitor => this.formatCompetitorOverview(competitor, competitiveResults)).join('\n\n')}

---

## DETAILED COMPETITIVE ANALYSIS

${this.groupResultsByCategory(competitiveResults).map(category => this.formatCategoryAnalysis(category)).join('\n\n')}

---

## STRATEGIC RECOMMENDATIONS

### Immediate Actions (0-3 months)
${this.getImmediateRecommendations(competitiveResults).map(rec => `- ${rec}`).join('\n')}

### Medium-term Strategies (3-12 months)
${this.getMediumTermRecommendations(competitiveResults).map(rec => `- ${rec}`).join('\n')}

### Long-term Positioning (12+ months)
${this.getLongTermRecommendations(competitiveResults).map(rec => `- ${rec}`).join('\n')}

---

## RISK ASSESSMENT

### High-Priority Risks
${this.getHighPriorityRisks(competitiveResults).map(risk => `- ${risk}`).join('\n')}

### Mitigation Strategies
${this.getMitigationStrategies(competitiveResults).map(strategy => `- ${strategy}`).join('\n')}

---

## CONCLUSION

${this.productName} maintains a strong competitive position with clear advantages in key areas. Strategic focus on identified improvement opportunities will further strengthen our market position and address competitive threats.

**Document End**
        `.trim();
    }

    createComplianceMatrixContent(validatedCriteria) {
        const headers = [
            'Criterion ID',
            'Criterion Text',
            'Compliance Status',
            'Response Summary',
            'Confidence Level',
            'References',
            'Category',
            'Priority'
        ];

        const rows = validatedCriteria.map(criterion => [
            criterion.id || 'N/A',
            `"${this.escapeCsvField(criterion.criterion_text || 'N/A')}"`,
            this.getComplianceStatusText(criterion.is_met),
            `"${this.escapeCsvField(criterion.validation_summary || 'No response available')}"`,
            this.getConfidenceLevel(criterion),
            `"${this.formatReferencesForCsv(criterion.validation_references)}"`,
            this.categorizecriterion(criterion.criterion_text || ''),
            this.determinePriority(criterion)
        ]);

        return [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
    }

    formatCriterionResponse(criterion, number) {
        const complianceStatus = this.getComplianceStatusText(criterion.is_met);
        const confidenceLevel = this.getConfidenceLevel(criterion);
        
        return `
### ${number}. CRITERION RESPONSE

**Criterion:** ${criterion.criterion_text || 'N/A'}

**Compliance Status:** ${complianceStatus}
**Confidence Level:** ${confidenceLevel}

**Response:**
${criterion.validation_summary || 'No detailed response available.'}

${this.formatReferences(criterion.validation_references)}

**Supporting Evidence:**
- Technical documentation available upon request
- Implementation examples and case studies
- Compliance certifications and audit reports

---
        `.trim();
    }

    formatReferences(references) {
        if (!references || references.length === 0) {
            return '**References:** No specific references provided.';
        }

        const formattedRefs = references.map((ref, index) => {
            if (ref.url && ref.url.trim()) {
                const title = ref.title || `Reference ${index + 1}`;
                return `${index + 1}. ${title} - ${ref.url}`;
            } else if (ref.title) {
                return `${index + 1}. ${ref.title}`;
            } else {
                return `${index + 1}. Supporting documentation available`;
            }
        });

        return `**References:**\n${formattedRefs.join('\n')}`;
    }

    formatCompetitorOverview(competitor, competitiveResults) {
        const competitorResults = competitiveResults.filter(r => 
            r.competitor && r.competitor.name === competitor
        );
        
        const score = this.calculateCompetitorScore(competitor, competitiveResults);
        const advantages = competitiveResults.filter(r => 
            r.competitor && r.competitor.name === competitor && r.advantage === 'advantage'
        ).length;

        return `
### ${competitor}
- **Overall Compliance Score:** ${score}%
- **Areas where we lead:** ${advantages} criteria
- **Key Strengths:** Advanced features, strong support
- **Key Weaknesses:** Higher cost, complex setup
        `.trim();
    }

    formatCategoryAnalysis(category) {
        return `
### ${category.name}

**Criteria Count:** ${category.results.length}
**Our Advantages:** ${category.results.filter(r => r.advantage === 'advantage').length}
**Competitive Areas:** ${category.results.filter(r => r.advantage === 'competitive').length}
**Improvement Needed:** ${category.results.filter(r => r.advantage === 'needs_improvement').length}

**Key Insights:**
${category.results.slice(0, 3).map(result => `- ${result.recommendation}`).join('\n')}
        `.trim();
    }

    // Helper Methods

    calculateComplianceStats(validatedCriteria) {
        return {
            total: validatedCriteria.length,
            compliant: validatedCriteria.filter(c => c.is_met === true).length,
            partial: validatedCriteria.filter(c => c.is_met === null).length,
            nonCompliant: validatedCriteria.filter(c => c.is_met === false).length
        };
    }

    calculateCompetitiveStats(competitiveResults) {
        return {
            advantages: competitiveResults.filter(r => r.advantage === 'advantage').length,
            competitive: competitiveResults.filter(r => r.advantage === 'competitive').length,
            improvements: competitiveResults.filter(r => r.advantage === 'needs_improvement').length
        };
    }

    getUniqueCompetitors(competitiveResults) {
        const competitors = new Set();
        competitiveResults.forEach(result => {
            if (result.competitor && result.competitor.name) {
                competitors.add(result.competitor.name);
            }
        });
        return Array.from(competitors);
    }

    calculateOverallScore(competitiveResults) {
        if (competitiveResults.length === 0) return 0;
        
        const yourAdvantages = competitiveResults.filter(r => r.advantage === 'advantage').length;
        const competitive = competitiveResults.filter(r => r.advantage === 'competitive').length;
        
        return Math.round(((yourAdvantages * 100 + competitive * 75) / competitiveResults.length));
    }

    calculateCompetitorScore(competitor, competitiveResults) {
        const competitorResults = competitiveResults.filter(r => 
            r.competitor && r.competitor.name === competitor
        );
        
        if (competitorResults.length === 0) return 0;
        
        const totalScore = competitorResults.reduce((sum, result) => {
            return sum + (result.competitor.isMet === true ? 100 : 
                         result.competitor.isMet === false ? 0 : 50);
        }, 0);
        
        return Math.round(totalScore / competitorResults.length);
    }

    groupResultsByCategory(competitiveResults) {
        const categories = {};
        
        competitiveResults.forEach(result => {
            const category = this.categorizecriterion(result.criterionText);
            if (!categories[category]) {
                categories[category] = { name: category, results: [] };
            }
            categories[category].results.push(result);
        });
        
        return Object.values(categories);
    }

    categorizecriterion(text) {
        // First check if we have the actual category from the criteria data
        const validatedCriteria = window.validatedCriteria || [];
        const criterion = validatedCriteria.find(c => c.criterion_text === text);
        
        if (criterion && criterion.category) {
            return this.formatCategoryName(criterion.category);
        }
        
        // Fallback to text-based categorization
        const textLower = text.toLowerCase();
        
        if (textLower.includes('security') || textLower.includes('encryption') || textLower.includes('compliance')) {
            return 'Security & Compliance';
        } else if (textLower.includes('performance') || textLower.includes('speed') || textLower.includes('availability')) {
            return 'Performance & Scalability';
        } else if (textLower.includes('technical') || textLower.includes('system') || textLower.includes('technology')) {
            return 'Technical Requirements';
        } else if (textLower.includes('support') || textLower.includes('maintenance') || textLower.includes('service')) {
            return 'Support & Maintenance';
        } else if (textLower.includes('integration') || textLower.includes('api') || textLower.includes('compatibility')) {
            return 'Integration & Compatibility';
        } else if (textLower.includes('cost') || textLower.includes('price') || textLower.includes('financial')) {
            return 'Financial';
        } else {
            return 'General Requirements';
        }
    }

    formatCategoryName(category) {
        // Map API category values to display names
        const categoryMap = {
            'technical': 'Technical Requirements',
            'security': 'Security & Compliance',
            'performance': 'Performance & Scalability',
            'support': 'Support & Maintenance',
            'compliance': 'Security & Compliance',
            'integration': 'Integration & Compatibility',
            'financial': 'Financial',
            'other': 'General Requirements'
        };
        
        return categoryMap[category] || category.charAt(0).toUpperCase() + category.slice(1);
    }

    getComplianceStatusText(isMet) {
        if (isMet === true) return 'FULLY COMPLIANT';
        if (isMet === false) return 'NON-COMPLIANT';
        return 'PARTIALLY COMPLIANT';
    }

    getConfidenceLevel(criterion) {
        // In a real implementation, this would be based on actual confidence scores
        if (criterion.is_met === true) return 'HIGH';
        if (criterion.is_met === false) return 'HIGH';
        return 'MEDIUM';
    }

    categorizeText(text) {
        return this.categorizeTitle(text);
    }

    determinePriority(criterion) {
        const text = criterion.criterion_text || '';
        const textLower = text.toLowerCase();
        
        if (textLower.includes('must') || textLower.includes('shall') || textLower.includes('mandatory')) {
            return 'CRITICAL';
        } else if (textLower.includes('should') || textLower.includes('recommended')) {
            return 'HIGH';
        } else {
            return 'MEDIUM';
        }
    }

    identifyStrengths(validatedCriteria) {
        const compliantCriteria = validatedCriteria.filter(c => c.is_met === true);
        const strengths = [];
        
        if (compliantCriteria.length > 0) {
            strengths.push(`Strong compliance rate across ${compliantCriteria.length} criteria`);
        }
        
        // Add specific strengths based on criterion categories
        const securityCriteria = compliantCriteria.filter(c => 
            c.criterion_text && c.criterion_text.toLowerCase().includes('security')
        );
        if (securityCriteria.length > 0) {
            strengths.push('Robust security and compliance capabilities');
        }
        
        const performanceCriteria = compliantCriteria.filter(c => 
            c.criterion_text && c.criterion_text.toLowerCase().includes('performance')
        );
        if (performanceCriteria.length > 0) {
            strengths.push('High-performance architecture and scalability');
        }
        
        const supportCriteria = compliantCriteria.filter(c => 
            c.criterion_text && c.criterion_text.toLowerCase().includes('support')
        );
        if (supportCriteria.length > 0) {
            strengths.push('Comprehensive support and maintenance offerings');
        }
        
        if (strengths.length === 0) {
            strengths.push('Comprehensive solution addressing key business requirements');
        }
        
        return strengths;
    }

    getImmediateRecommendations(competitiveResults) {
        const improvements = competitiveResults.filter(r => r.advantage === 'needs_improvement');
        const recommendations = [];
        
        if (improvements.length > 0) {
            recommendations.push('Address identified gaps in competitive positioning');
            recommendations.push('Enhance marketing messaging for competitive advantages');
            recommendations.push('Develop detailed competitive response strategies');
        } else {
            recommendations.push('Maintain current competitive advantages');
            recommendations.push('Monitor competitor movements and market changes');
        }
        
        return recommendations;
    }

    getMediumTermRecommendations(competitiveResults) {
        return [
            'Invest in product enhancements for identified improvement areas',
            'Develop strategic partnerships to strengthen competitive position',
            'Enhance sales training on competitive differentiation',
            'Create detailed competitive battle cards for sales teams'
        ];
    }

    getLongTermRecommendations(competitiveResults) {
        return [
            'Develop next-generation capabilities to maintain leadership',
            'Consider strategic acquisitions to address capability gaps',
            'Build ecosystem partnerships for comprehensive solutions',
            'Invest in emerging technologies for future competitive advantage'
        ];
    }

    getHighPriorityRisks(competitiveResults) {
        const risks = [];
        const improvements = competitiveResults.filter(r => r.advantage === 'needs_improvement');
        
        if (improvements.length > 3) {
            risks.push('Multiple areas where competitors have advantages');
        }
        
        risks.push('Market perception challenges in key differentiating areas');
        risks.push('Competitive response to our market positioning');
        
        return risks;
    }

    getMitigationStrategies(competitiveResults) {
        return [
            'Accelerate product development roadmap for identified gaps',
            'Enhance customer communication about unique value propositions',
            'Develop strategic messaging around competitive advantages',
            'Implement regular competitive intelligence monitoring'
        ];
    }

    formatReferencesForCsv(references) {
        if (!references || references.length === 0) {
            return 'No references provided';
        }
        
        return references.map((ref, index) => {
            if (ref.url && ref.url.trim()) {
                const title = ref.title || `Reference ${index + 1}`;
                return `${title}: ${ref.url}`;
            } else if (ref.title) {
                return ref.title;
            } else {
                return `Reference ${index + 1}`;
            }
        }).join('; ');
    }

    escapeCsvField(text) {
        if (!text) return '';
        // Escape quotes and handle multiline text
        return text.replace(/"/g, '""').replace(/\n/g, ' ').replace(/\r/g, ' ');
    }

    downloadTextAsFile(content, filename, mimeType = 'text/plain') {
        const blob = new Blob([content], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Clean up the URL object
        setTimeout(() => window.URL.revokeObjectURL(url), 100);
    }

    getDateString() {
        const now = new Date();
        return now.getFullYear() + 
               String(now.getMonth() + 1).padStart(2, '0') + 
               String(now.getDate()).padStart(2, '0');
    }

    // Public methods for getting generated document info
    getGeneratedDocuments() {
        return this.generatedDocuments;
    }

    hasDocument(type) {
        return this.generatedDocuments[type] !== undefined;
    }

    getDocumentInfo(type) {
        return this.generatedDocuments[type] || null;
    }
}
