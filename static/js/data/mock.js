export const mockData = {
    criteria: [
        {
            id: 'T001',
            category: 'technical',
            criterion: 'System must support 99.9% uptime SLA with automatic failover capabilities',
            source: 'RFP_TechServices_2024.pdf (Page 12)',
            status: 'approved'
        },
        // ...existing criteria data...
        {
            id: 'SUP001',
            category: 'support',
            criterion: '24/7 technical support with 1-hour response time for critical issues',
            source: 'Technical_Requirements.docx (Section 5.2)',
            status: 'pending'
        }
    ],
    
    responses: [
        {
            id: 'T001',
            criterion: 'System must support 99.9% uptime SLA with automatic failover capabilities',
            compliance: 'compliant',
            response: 'Your Solution exceeds this requirement with 99.95% uptime SLA. We maintain redundant infrastructure across multiple availability zones with automatic failover that completes within 30 seconds.',
            references: 'Infrastructure_Overview.pdf, SLA_Agreement.pdf',
            confidence: 'high'
        },
        // ...existing responses data...
    ],
    
    competitive: [
        {
            id: 'T001',
            criterion: 'System must support 99.9% uptime SLA with automatic failover capabilities',
            yourResponse: 'Your Solution exceeds this requirement with 99.95% uptime SLA. We maintain redundant infrastructure across multiple availability zones with automatic failover that completes within 30 seconds.',
            yourScore: 'high',
            bestCompetitor: 'Amazon AWS',
            competitorScore: 'high',
            position: 'competitive',
            recommendation: 'Highlight our superior monitoring capabilities and faster failover times'
        },
        // ...existing competitive data...
    ],
    
    logs: {
        upload: [
            { timestamp: '2024-01-15 09:15:32', agent: 'Document Agent', message: 'Starting document upload process' },
            // ...existing upload logs...
        ],
        
        generate: [
            { timestamp: '2024-01-15 14:20:10', agent: 'Response Agent', message: 'Initializing AI response generation' },
            // ...existing generate logs...
        ],
        
        competitive: [
            { timestamp: '2024-01-15 15:45:10', agent: 'Competitive Agent', message: 'Initializing competitive analysis for 5 major cloud providers' },
            // ...existing competitive logs...
        ]
    }
};
