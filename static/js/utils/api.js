export class APIClient {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
    }

    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    console.log('Error response data:', errorData);
                    
                    // Handle different error response formats
                    if (typeof errorData === 'string') {
                        errorMessage = errorData;
                    } else if (errorData.detail) {
                        if (Array.isArray(errorData.detail)) {
                            // Validation errors from FastAPI
                            errorMessage = errorData.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
                        } else {
                            errorMessage = errorData.detail;
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    } else {
                        errorMessage = JSON.stringify(errorData);
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            } else {
                return await response.text();
            }
        } catch (error) {
            console.error('API request failed:', endpoint, error);
            throw error;
        }
    }

    // Document endpoints
    async uploadDocument(file) {
        console.log('Preparing to upload file:', {
            name: file.name,
            type: file.type,
            size: file.size,
            lastModified: file.lastModified
        });
        
        // Validate file before creating FormData
        if (!file || file.size === 0) {
            throw new Error('Invalid or empty file provided');
        }
        
        const formData = new FormData();
        formData.append('file', file, file.name);
        
        console.log('FormData created with file:', {
            name: file.name,
            size: file.size,
            type: file.type
        });
        
        // Log FormData entries for debugging
        for (let [key, value] of formData.entries()) {
            if (value instanceof File) {
                console.log(`FormData entry - ${key}:`, {
                    name: value.name,
                    type: value.type,
                    size: value.size,
                    lastModified: value.lastModified
                });
            } else {
                console.log(`FormData entry - ${key}:`, value);
            }
        }

        try {
            const response = await fetch(`${this.baseURL}/documents/upload`, {
                method: 'POST',
                body: formData,
                // Don't set Content-Type - let browser handle multipart/form-data boundary
            });
            
            console.log('Upload response received:', {
                status: response.status,
                ok: response.ok,
                statusText: response.statusText,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (!response.ok) {
                let errorMessage;
                try {
                    const errorData = await response.json();
                    console.log('Error response data:', errorData);
                    
                    if (typeof errorData === 'string') {
                        errorMessage = errorData;
                    } else if (errorData.detail) {
                        if (Array.isArray(errorData.detail)) {
                            errorMessage = errorData.detail.map(err => `${err.loc?.join('.')}: ${err.msg}`).join(', ');
                        } else {
                            errorMessage = errorData.detail;
                        }
                    } else if (errorData.message) {
                        errorMessage = errorData.message;
                    } else if (errorData.error) {
                        errorMessage = errorData.error;
                    } else {
                        errorMessage = JSON.stringify(errorData);
                    }
                } catch (parseError) {
                    console.error('Failed to parse error response:', parseError);
                    const responseText = await response.text();
                    console.log('Raw error response:', responseText);
                    errorMessage = `HTTP ${response.status}: ${response.statusText}`;
                }
                throw new Error(errorMessage);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && contentType.includes('application/json')) {
                const result = await response.json();
                console.log('Upload successful, parsed response:', result);
                
                // Validate that we have a document ID in the response
                const documentId = result.document?.id || result.document_id || result.id;
                if (!documentId) {
                    console.warn('No document ID found in response structure:', result);
                }
                
                return result;
            } else {
                const result = await response.text();
                console.log('Upload successful, text response:', result);
                return result;
            }
        } catch (error) {
            console.error('Upload request failed:', error);
            throw error;
        }
    }

    async processDocument(documentId) {
        return this.request(`/documents/${documentId}/process`, {
            method: 'POST'
        });
    }

    async getDocument(documentId) {
        return this.request(`/documents/${documentId}`);
    }

    async getDocuments(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        
        const query = params.toString();
        return this.request(`/documents${query ? '?' + query : ''}`);
    }

    async deleteDocument(documentId) {
        return this.request(`/documents/${documentId}`, {
            method: 'DELETE'
        });
    }

    // Criteria endpoints
    async getCriteria(documentId) {
        if (!documentId) {
            throw new Error('Document ID is required');
        }

        const response = await this.request(`/documents/${documentId}/criteria`);
        return response;
    }

    async getCriteria(filters = {}) {
        const params = new URLSearchParams();
        Object.entries(filters).forEach(([key, value]) => {
            if (value !== null && value !== undefined && value !== '') {
                params.append(key, value);
            }
        });
        
        const query = params.toString();
        return this.request(`/criteria${query ? '?' + query : ''}`);
    }

    async getCriterion(criterionId) {
        return this.request(`/criteria/${criterionId}`);
    }

    async updateCriterion(criterionId, updates, reviewedBy = null) {
        const params = reviewedBy ? `?reviewed_by=${encodeURIComponent(reviewedBy)}` : '';
        return this.request(`/criteria/${criterionId}${params}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });
    }

    async approveCriterion(criterionId, reviewedBy = null) {
        const params = reviewedBy ? `?reviewed_by=${encodeURIComponent(reviewedBy)}` : '';
        return this.request(`/criteria/${criterionId}/approve${params}`, {
            method: 'POST'
        });
    }

    async rejectCriterion(criterionId, reason, reviewedBy = null) {
        const params = new URLSearchParams({ reason });
        if (reviewedBy) params.append('reviewed_by', reviewedBy);
        
        return this.request(`/criteria/${criterionId}/reject?${params}`, {
            method: 'POST'
        });
    }

    async bulkUpdateCriteria(criteriaIds, updates, reviewedBy = null) {
        return this.request('/criteria/bulk', {
            method: 'PUT',
            body: JSON.stringify({
                criteria_ids: criteriaIds,
                updates,
                reviewed_by: reviewedBy
            })
        });
    }

    async getCriteriaStatistics(documentId = null) {
        const params = documentId ? `?document_id=${documentId}` : '';
        return this.request(`/criteria/statistics/overview${params}`);
    }

    async autoCategorize(criteriaIds) {
        return this.request('/criteria/auto-categorize', {
            method: 'POST',
            body: JSON.stringify(criteriaIds)
        });
    }

    async testConnection() {
        try {
            // Test multiple endpoints to see what's available
            const endpoints = ['/health', '/', '/docs', '/openapi.json'];
            const results = {};
            
            for (const endpoint of endpoints) {
                try {
                    console.log(`Testing endpoint: ${endpoint}`);
                    const response = await fetch(`${this.baseUrl}${endpoint}`, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        }
                    });
                    results[endpoint] = {
                        status: response.status,
                        ok: response.ok,
                        headers: Object.fromEntries(response.headers.entries())
                    };
                } catch (err) {
                    results[endpoint] = { error: err.message };
                }
            }
            
            return { success: true, data: results };
        } catch (error) {
            console.error('API connection test failed:', error);
            return { success: false, error: error.message };
        }
    }

    async testUpload() {
        try {
            // Create a proper test PDF file with actual PDF content
            const pdfContent = '%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/MediaBox [0 0 612 792]\n>>\nendobj\nxref\n0 4\n0000000000 65535 f \n0000000009 00000 n \n0000000074 00000 n \n0000000120 00000 n \ntrailer\n<<\n/Size 4\n/Root 1 0 R\n>>\nstartxref\n202\n%%EOF';
            const testFile = new File([pdfContent], 'test.pdf', { type: 'application/pdf' });
            
            console.log('Testing upload with PDF file:', {
                name: testFile.name,
                type: testFile.type,
                size: testFile.size
            });
            
            const formData = new FormData();
            formData.append('file', testFile);
            
            // Verify FormData content
            for (let [key, value] of formData.entries()) {
                if (value instanceof File) {
                    console.log(`Test FormData - ${key}:`, {
                        name: value.name,
                        type: value.type,
                        size: value.size
                    });
                }
            }
            
            console.log('Testing upload to /api/documents/upload');
            const response = await fetch(`${this.baseURL}/documents/upload`, {
                method: 'POST',
                body: formData
            });
            
            console.log('Upload test response:', {
                status: response.status,
                ok: response.ok,
                headers: Object.fromEntries(response.headers.entries())
            });
            
            if (response.ok) {
                const data = await response.json();
                return { success: true, data };
            } else {
                const errorText = await response.text();
                return { success: false, error: errorText, status: response.status };
            }
        } catch (error) {
            console.error('Upload test failed:', error);
            return { success: false, error: error.message };
        }
    }

    async getCriteria(documentId = null) {
        try {
            const params = new URLSearchParams();
            if (documentId) {
                params.append('document_id', documentId);
            }
            
            // Fix: Remove duplicate /api prefix
            const url = `${this.baseURL}/criteria${params.toString() ? '?' + params.toString() : ''}`;
            const response = await fetch(url);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            return data.criteria || [];
        } catch (error) {
            console.error('Error getting criteria:', error);
            throw error;
        }
    }

    async validateCriterion(criterionId, productName, useDeepResearch = false) {
        try {
            const response = await fetch(`${this.baseURL}/criteria/${criterionId}/validate`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    product_name: productName,
                    use_deep_research: useDeepResearch
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.detail || `HTTP error! status: ${response.status}`);
            }

            return await response.json();
        } catch (error) {
            console.error('Error validating criterion:', error);
            throw error;
        }
    }

    // Mock functions for testing without backend
    mockUploadDocument(file) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockDocumentId = 'mock-doc-' + Date.now();
                console.log('Mock upload successful, document ID:', mockDocumentId);
                resolve({
                    document_id: mockDocumentId,
                    filename: file.name,
                    status: 'uploaded'
                });
            }, 1000); // Simulate upload delay
        });
    }

    mockExtractCriteria(documentId) {
        return new Promise((resolve) => {
            setTimeout(() => {
                const mockCriteria = [
                    {
                        id: 1,
                        text: "The solution must support PDF document processing",
                        category: "Technical Requirements",
                        priority: "high",
                        source: "Document section 2.1"
                    },
                    {
                        id: 2,
                        text: "System must be available 99.9% of the time",
                        category: "Performance & Scalability",
                        priority: "critical",
                        source: "Document section 3.2"
                    },
                    {
                        id: 3,
                        text: "All data must be encrypted at rest and in transit",
                        category: "Security & Compliance",
                        priority: "critical",
                        source: "Document section 4.1"
                    },
                    {
                        id: 4,
                        text: "Solution must integrate with existing ERP systems",
                        category: "Integration & Compatibility",
                        priority: "medium",
                        source: "Document section 5.3"
                    },
                    {
                        id: 5,
                        text: "24/7 technical support must be provided",
                        category: "Support & Maintenance",
                        priority: "high",
                        source: "Document section 6.1"
                    }
                ];

                console.log('Mock criteria extraction successful, criteria count:', mockCriteria.length);
                resolve({
                    criteria: mockCriteria,
                    document_id: documentId,
                    extraction_status: 'completed'
                });
            }, 2000); // Simulate processing delay
        });
    }
}

// Create global API client instance
export const apiClient = new APIClient();

// Enhanced test function
window.testAPI = async function() {
    console.log('Testing API connection and endpoints...');
    
    try {
        // Test basic connectivity
        const healthTest = await apiClient.testConnection();
        console.log('Connectivity test results:', healthTest);
        
        // Test upload endpoint
        const uploadTest = await apiClient.testUpload();
        console.log('Upload test results:', uploadTest);
        
        if (window.showNotification) {
            if (healthTest.success && uploadTest.success) {
                window.showNotification('API tests successful!', 'success');
            } else {
                const errors = [];
                if (!healthTest.success) errors.push(`Connectivity: ${healthTest.error}`);
                if (!uploadTest.success) errors.push(`Upload: ${uploadTest.error}`);
                window.showNotification(`API tests failed: ${errors.join(', ')}`, 'error');
            }
        }
        
        // Display detailed results
        console.table({
            'Connectivity Test': healthTest.success ? 'PASS' : 'FAIL',
            'Upload Test': uploadTest.success ? 'PASS' : 'FAIL'
        });
        
    } catch (error) {
        console.error('Test failed:', error);
        if (window.showNotification) {
            window.showNotification(`Test failed: ${error.message}`, 'error');
        }
    }
};

// Debug function to check what the server expects
window.debugUpload = async function() {
    try {
        // First check if the server is running
        const response = await fetch('/');
        console.log('Server response:', response.status);
        
        // Check if there's an OpenAPI spec
        const docsResponse = await fetch('/docs');
        if (docsResponse.ok) {
            console.log('API docs available at /docs');
        }
        
        // Try the upload endpoint with OPTIONS to see what it expects
        const optionsResponse = await fetch('/documents/upload', {
            method: 'OPTIONS'
        });
        console.log('OPTIONS response:', {
            status: optionsResponse.status,
            headers: Object.fromEntries(optionsResponse.headers.entries())
        });
        
    } catch (error) {
        console.error('Debug failed:', error);
    }
};
