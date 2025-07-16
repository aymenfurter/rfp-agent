import { apiClient } from '../utils/api.js';
import { showNotification } from '../utils/notifications.js';
import { activateStep } from '../utils/steps.js';

let uploadedFiles = [];
let processingLogs = {
    upload: [],
    extract: [],
    generate: [],
    competitive: []
};

export function initializeUploadStep() {
    // Initialize file input and drop area
    initializeFileUpload();
    
    // Listen for criteria extraction completion
    document.addEventListener('criteriaExtracted', handleCriteriaExtracted);
    
    // Make functions globally available
    window.uploadDocument = uploadDocument;
    window.getProcessingLogs = getProcessingLogs;
}

function initializeFileUpload() {
    const uploadArea = document.getElementById('upload-placeholder');
    const fileGrid = uploadArea?.parentElement;
    
    if (!uploadArea || !fileGrid) return;
    
    // Create file input
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.multiple = true;
    fileInput.accept = '.pdf,.xlsx,.xls';
    fileInput.style.display = 'none';
    fileInput.id = 'file-input';
    document.body.appendChild(fileInput);
    
    // Click handler for upload area
    uploadArea.addEventListener('click', () => {
        fileInput.click();
    });
    
    // File input change handler
    fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            await handleFiles(files);
        }
    });
    
    // Drag and drop handlers
    uploadArea.addEventListener('dragover', (e) => {
        e.preventDefault();
        uploadArea.classList.add('drag-over');
    });
    
    uploadArea.addEventListener('dragleave', (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
    });
    
    uploadArea.addEventListener('drop', async (e) => {
        e.preventDefault();
        uploadArea.classList.remove('drag-over');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type === 'application/pdf' || 
            file.name.endsWith('.xlsx') || 
            file.name.endsWith('.xls')
        );
        
        if (files.length > 0) {
            await handleFiles(files);
        } else {
            showNotification('Please upload only PDF or Excel files', 'error');
        }
    });
}

async function handleFiles(files) {
    const fileGrid = document.querySelector('.file-grid');
    const uploadPlaceholder = document.getElementById('upload-placeholder');
    
    // Hide placeholder
    if (uploadPlaceholder) {
        uploadPlaceholder.style.display = 'none';
    }
    
    // Validate files before processing
    const validFiles = [];
    for (const file of files) {
        try {
            await validateFileContent(file);
            validFiles.push(file);
        } catch (error) {
            console.error('File validation failed:', file.name, error);
            showNotification(`${file.name}: ${error.message}`, 'error');
        }
    }
    
    if (validFiles.length === 0) {
        showNotification('No valid files to upload', 'error');
        return;
    }
    
    // Process each valid file
    for (const file of validFiles) {
        try {
            await processFile(file, fileGrid);
        } catch (error) {
            console.error('Error processing file:', error);
            showNotification(`Error processing ${file.name}: ${error.message}`, 'error');
        }
    }
}

async function processFile(file, container) {
    // Create file card
    const fileCard = createFileCard(file);
    container.appendChild(fileCard);
    
    try {
        // Validate file content
        await validateFileContent(file);
        
        // Update progress
        updateUploadProgress(10, `Preparing ${file.name}...`);
        
        // Read file content to ensure it's not empty
        const fileBuffer = await readFileAsArrayBuffer(file);
        if (!fileBuffer || fileBuffer.byteLength === 0) {
            throw new Error('File appears to be empty or corrupted');
        }
        
        console.log('File content verified:', {
            name: file.name,
            type: file.type,
            size: file.size,
            bufferSize: fileBuffer.byteLength,
            lastModified: file.lastModified
        });
        
        // Create FormData with verified file
        const formData = new FormData();
        const fileBlob = new Blob([fileBuffer], { type: file.type });
        const verifiedFile = new File([fileBlob], file.name, { 
            type: file.type,
            lastModified: file.lastModified 
        });
        
        formData.append('file', verifiedFile);
        
        // Log FormData contents for debugging
        console.log('FormData prepared:', {
            fileName: verifiedFile.name,
            fileSize: verifiedFile.size,
            fileType: verifiedFile.type
        });
        
        // Add debugging info to logs
        addToProcessingLogs('upload', `Starting upload of ${file.name} (${formatFileSize(file.size)})`, 'info');
        
        updateUploadProgress(30, `Uploading ${file.name}...`);
        
        // Upload with custom FormData
        const uploadResult = await uploadFileWithFormData(formData);
        console.log('Upload result:', uploadResult);
        
        if (!uploadResult) {
            throw new Error('No response from upload');
        }
        
        // Handle the new response structure
        let documentId;
        let documentInfo = null;
        let processingResult = null;
        
        if (uploadResult.document) {
            documentInfo = uploadResult.document;
            documentId = documentInfo.id;
            processingResult = uploadResult.processing_result;
        } else {
            // Handle legacy response format
            if (typeof uploadResult === 'string') {
                try {
                    const parsed = JSON.parse(uploadResult);
                    documentInfo = parsed.document || parsed;
                    documentId = documentInfo?.id || parsed.document_id || parsed.id;
                } catch {
                    documentId = uploadResult;
                }
            } else {
                documentInfo = uploadResult.document || uploadResult;
                documentId = documentInfo?.id || uploadResult.document_id || uploadResult.id;
            }
        }
        
        if (!documentId) {
            console.error('Upload result structure:', uploadResult);
            throw new Error('No document ID returned from upload. Server response: ' + JSON.stringify(uploadResult));
        }
        
        console.log('Document ID extracted:', documentId);
        console.log('Document info:', documentInfo);
        console.log('Processing result:', processingResult);
        
        // Update file card with processing results
        if (processingResult && documentInfo) {
            updateFileCardWithProcessingResults(fileCard, documentInfo, processingResult);
            updateUploadProgress(100, 'Document processing complete');
            addToProcessingLogs('upload', `Document processing successful for ${documentId}`, 'success');
        } else {
            updateFileCardStatus(fileCard, 'success', 'Document uploaded (processing may be needed)');
            updateUploadProgress(90, 'Document uploaded');
            addToProcessingLogs('upload', `Document uploaded, processing may be needed`, 'warning');
        }
        
        // Add to uploaded files with full document information
        uploadedFiles.push({
            file,
            documentId: documentId,
            uploadResult: uploadResult,
            documentInfo: documentInfo,
            processingResult: processingResult
        });
        
        // Add to processing logs
        addToProcessingLogs('upload', `Successfully uploaded ${file.name}`, 'success');
        
        updateUploadProgress(100, 'Complete!');
        
        // Update file count
        updateFileCount();
        
        // Check if we should activate next step
        if (uploadedFiles.length > 0) {
            setTimeout(() => {
                handleDocumentUploaded({ detail: { documentCount: uploadedFiles.length, uploadedFiles: uploadedFiles } });
            }, 1000);
        }
        
        return { success: true, documentId: documentId };
        
    } catch (error) {
        console.error('Error processing file:', error);
        const errorMessage = error.message || 'Unknown error occurred';
        updateFileCardStatus(fileCard, 'error', `Error: ${errorMessage}`);
        addToProcessingLogs('upload', `Error processing ${file.name}: ${errorMessage}`, 'error');
        updateUploadProgress(0, 'Upload failed');
        
        // Show user-friendly error notification
        showNotification(`Failed to process ${file.name}: ${errorMessage}`, 'error');
        
        throw error;
    }
}

function createFileCard(file) {
    const card = document.createElement('div');
    card.className = 'file-card processing';
    card.innerHTML = `
        <div class="file-icon">
            <i class="fas fa-file-${getFileIcon(file)}"></i>
        </div>
        <div class="file-info">
            <h4 class="file-name" title="${file.name}">${file.name}</h4>
            <p class="file-size">${formatFileSize(file.size)}</p>
        </div>
        <div class="status-badge processing">
            <i class="fas fa-spinner animate-spin"></i>
            <span>Uploading...</span>
        </div>
    `;
    return card;
}

function updateFileCardStatus(card, status, message) {
    const statusBadge = card.querySelector('.status-badge');
    if (!statusBadge) return;
    
    statusBadge.className = `status-badge ${status}`;
    
    let icon = 'fas fa-spinner animate-spin';
    if (status === 'success') icon = 'fas fa-check';
    else if (status === 'error') icon = 'fas fa-times';
    else if (status === 'processing') icon = 'fas fa-cog animate-spin';
    
    statusBadge.innerHTML = `
        <i class="${icon}"></i>
        <span>${message}</span>
    `;
    
    card.className = `file-card ${status}`;
}

function getFileIcon(file) {
    if (file.type === 'application/pdf') return 'pdf';
    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) return 'excel';
    return 'alt';
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function updateUploadProgress(percentage, message) {
    const progressContainer = document.getElementById('upload-progress-container');
    const progressFill = document.getElementById('upload-progress-fill');
    const progressText = document.getElementById('upload-progress-text');
    
    if (progressContainer && progressFill && progressText) {
        progressContainer.style.display = 'block';
        progressFill.style.width = `${percentage}%`;
        progressText.textContent = message;
        
        if (percentage >= 100) {
            setTimeout(() => {
                progressContainer.style.display = 'none';
            }, 2000);
        }
    }
}

function updateFileCount() {
    // Calculate requirements vs total files
    const totalFiles = uploadedFiles.length;
    const requirementsFiles = uploadedFiles.filter(uploadedFile => {
        const docInfo = uploadedFile.documentInfo;
        return docInfo?.contains_criteria === true;
    }).length;
    
    // Update counters in the UI
    const filesCountElement = document.getElementById('upload-files-count');
    const requirementsCountElement = document.getElementById('requirements-files-count');
    
    if (filesCountElement) {
        filesCountElement.textContent = `${totalFiles} file${totalFiles !== 1 ? 's' : ''} processed`;
    }
    
    if (requirementsCountElement) {
        requirementsCountElement.textContent = `${requirementsFiles} requirements document${requirementsFiles !== 1 ? 's' : ''}`;
    }
    
    // Complete upload step if we have any files uploaded
    if (totalFiles > 0) {
        setTimeout(() => {
            handleDocumentUploaded({ 
                detail: { 
                    documentCount: totalFiles, 
                    uploadedFiles: uploadedFiles 
                } 
            });
        }, 500); // Small delay to allow UI updates
    }
}

function enableReviewStep(requirementsCount) {
    const viewCriteriaBtn = document.getElementById('view-criteria-btn');
    const approveAllBtn = document.getElementById('approve-all-btn');
    
    // Update the buttons to start criteria extraction
    if (viewCriteriaBtn) {
        viewCriteriaBtn.classList.remove('btn-disabled');
        viewCriteriaBtn.removeAttribute('disabled');
        viewCriteriaBtn.classList.add('btn-secondary');
        viewCriteriaBtn.innerHTML = '<i class="fas fa-search"></i> Extract Criteria';
        viewCriteriaBtn.onclick = () => window.extractCriteria && window.extractCriteria();
    }
    
    // Keep approve button disabled until criteria are extracted
    if (approveAllBtn) {
        approveAllBtn.classList.add('btn-disabled');
        approveAllBtn.setAttribute('disabled', 'true');
    }
    
    // Update progress text
    const reviewProgressText = document.querySelector('#step-review .progress-text');
    if (reviewProgressText) {
        reviewProgressText.textContent = `${requirementsCount} requirements document${requirementsCount !== 1 ? 's' : ''} ready for criteria extraction`;
    }
    
    // Update total criteria count to 0 initially
    const totalCriteriaElement = document.querySelector('#step-review .stat-card .stat-number');
    if (totalCriteriaElement) {
        totalCriteriaElement.textContent = '0';
    }
    
    // Show success message
    showNotification(`Found ${requirementsCount} document${requirementsCount !== 1 ? 's' : ''} containing criteria. Ready for extraction.`, 'success');
}

function handleCriteriaExtracted(event) {
    const { criteriaCount, documentCount } = event.detail;
    
    // Enable review step buttons
    enableReviewStepButtons(criteriaCount);
    
    // Move to review step
    activateStep('step-review');
    
    showNotification(`Successfully extracted ${criteriaCount} criteria from ${documentCount} documents`, 'success');
}

function handleDocumentUploaded(event) {
    const { documentCount, uploadedFiles } = event.detail;
    
    // Enable review step
    enableReviewStep(documentCount);
    
    // Complete upload step and move to review step
    completeUploadStep();
    
    showNotification(`Successfully uploaded ${documentCount} documents. Ready for criteria extraction.`, 'success');
}

function completeUploadStep() {
    const uploadCard = document.getElementById('step-upload');
    const reviewCard = document.getElementById('step-review');
    
    if (uploadCard) {
        // Mark upload step as completed
        uploadCard.classList.remove('active');
        uploadCard.classList.add('completed');
        
        // Update progress to show completion
        const progressFill = uploadCard.querySelector('.progress-fill');
        const progressText = uploadCard.querySelector('.progress-text');
        
        if (progressFill) progressFill.style.width = '100%';
        if (progressText) progressText.textContent = 'Upload complete';
    }
    
    if (reviewCard) {
        // Activate review step
        reviewCard.classList.remove('disabled');
        reviewCard.classList.add('active');
    }
}

function enableReviewStepButtons(documentCount) {
    const viewCriteriaBtn = document.getElementById('view-criteria-btn');
    const approveAllBtn = document.getElementById('approve-all-btn');
    
    if (viewCriteriaBtn) {
        viewCriteriaBtn.classList.remove('btn-disabled');
        viewCriteriaBtn.removeAttribute('disabled');
        viewCriteriaBtn.classList.add('btn-secondary');
    }
    
    if (approveAllBtn) {
        approveAllBtn.classList.remove('btn-disabled');
        approveAllBtn.removeAttribute('disabled');
        approveAllBtn.classList.add('btn-primary');
    }
    
    // Update progress text
    const reviewProgressText = document.querySelector('#step-review .progress-text');
    if (reviewProgressText) {
        reviewProgressText.textContent = `${documentCount} documents ready for criteria extraction`;
    }
}

function addToProcessingLogs(step, message, type = 'info') {
    const timestamp = new Date().toLocaleString();
    const logEntry = {
        timestamp,
        message,
        type
    };
    
    if (!processingLogs[step]) {
        processingLogs[step] = [];
    }
    
    processingLogs[step].push(logEntry);
}

function getProcessingLogs(step) {
    return processingLogs[step] || [];
}

function uploadDocument() {
    const fileInput = document.getElementById('file-input');
    if (fileInput) {
        fileInput.click();
    }
}

// Export uploaded files data for other modules
export function getUploadedFiles() {
    return uploadedFiles;
}

// Helper functions
async function validateFileContent(file) {
    return new Promise((resolve, reject) => {
        if (!file || file.size === 0) {
            reject(new Error('File is empty or invalid'));
            return;
        }
        
        const maxSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxSize) {
            reject(new Error('File size exceeds 50MB limit'));
            return;
        }
        
        const allowedTypes = ['application/pdf', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/vnd.ms-excel'];
        const allowedExtensions = ['.pdf', '.xlsx', '.xls'];
        
        const hasValidType = allowedTypes.includes(file.type);
        const hasValidExtension = allowedExtensions.some(ext => file.name.toLowerCase().endsWith(ext));
        
        if (!hasValidType && !hasValidExtension) {
            reject(new Error('Only PDF and Excel files are supported'));
            return;
        }
        
        resolve();
    });
}

async function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsArrayBuffer(file);
    });
}

async function uploadFileWithFormData(formData) {
    try {
        return await apiClient.uploadDocument(formData.get('file'));
    } catch (error) {
        console.error('Upload failed:', error);
        throw error;
    }
}

function formatDocumentType(type) {
    const typeMap = {
        'scope_of_work': 'Scope of Work',
        'rfp': 'RFP',
        'technical_requirements': 'Technical Requirements',
        'vendor_requirements': 'Vendor Requirements',
        'system_requirements': 'System Requirements',
        'functional_requirements': 'Functional Requirements',
        'technical_specifications': 'Technical Specifications',
        'procurement_requirements': 'Procurement Requirements',
        'bid_requirements': 'Bid Requirements',
        'project_requirements': 'Project Requirements',
        'rfp_addendum': 'RFP Addendum',
        'amendment': 'Amendment',
        'statement_of_work': 'Statement of Work',
        'spreadsheet': 'Spreadsheet',
        'other': 'Other Document',
        'unknown': 'Unknown Type'
    };
    
    return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

function updateFileCardWithProcessingResults(fileCard, documentInfo, processResult) {
    if (!documentInfo) {
        updateFileCardStatus(fileCard, 'success', 'Document processed successfully');
        return;
    }
    
    // Extract information from documentInfo (which now contains processed data)
    const docType = documentInfo.document_type || 'unknown';
    const containsCriteria = documentInfo.contains_criteria || false;
    const confidence = documentInfo.classification_confidence || 0;
    const criteriaCount = documentInfo.criteria_count || 0;
    
    // Update the file card with enhanced information
    updateFileCardStatus(fileCard, 'success', 'Document processed successfully');
    
    // Add classification and criteria information to the card
    const fileInfo = fileCard.querySelector('.file-info');
    if (fileInfo) {
        // Add document type badge with better layout
        const typeInfo = document.createElement('div');
        typeInfo.className = 'document-classification';
        typeInfo.innerHTML = `
            <div class="classification-badges">
                <span class="document-type-badge ${docType.replace(/_/g, '-')}">${formatDocumentType(docType)}</span>
                ${containsCriteria ? 
                    `<span class="criteria-badge criteria-found">
                        <i class="fas fa-list-check"></i>
                        Contains Criteria
                    </span>` : 
                    `<span class="criteria-badge no-criteria">
                        <i class="fas fa-info-circle"></i>
                        No Criteria
                    </span>`
                }
            </div>
            <div class="classification-details">
                <span class="confidence-indicator">
                    <i class="fas fa-chart-line"></i>
                    ${Math.round(confidence * 100)}% confidence
                </span>
                ${criteriaCount > 0 ? 
                    `<span class="criteria-count">
                        <i class="fas fa-list-ol"></i>
                        ${criteriaCount} criteria found
                    </span>` : ''
                }
            </div>
        `;
        
        fileInfo.appendChild(typeInfo);
    }
    
    // Add file actions
    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'file-actions';
    actionsDiv.innerHTML = `
        <button class="action-btn" onclick="viewDocumentDetails('${documentInfo.id}')" title="View details">
            <i class="fas fa-eye"></i>
        </button>
        <button class="action-btn" onclick="removeDocument('${documentInfo.id}')" title="Remove">
            <i class="fas fa-trash"></i>
        </button>
    `;
    
    fileCard.appendChild(actionsDiv);
}

// Add file actions styles and functionality
window.viewDocumentDetails = function(documentId) {
    const uploadedFile = uploadedFiles.find(f => f.documentId === documentId);
    if (!uploadedFile) {
        showNotification('Document not found', 'error');
        return;
    }
    
    const docInfo = uploadedFile.documentInfo;
    
    // Create a modal with document details
    const detailsModal = document.createElement('div');
    detailsModal.className = 'modal-overlay';
    detailsModal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h3 class="text-xl-medium text-foreground-900">Document Details</h3>
                <button class="modal-close" onclick="this.closest('.modal-overlay').remove()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
            <div class="modal-body">
                <div class="space-y-4">
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">File Information</h4>
                        <div class="bg-background-100 p-3 rounded">
                            <p><strong>Name:</strong> ${docInfo.original_filename}</p>
                            <p><strong>Size:</strong> ${formatFileSize(docInfo.file_size)}</p>
                            <p><strong>Type:</strong> ${docInfo.content_type}</p>
                            <p><strong>Uploaded:</strong> ${new Date(docInfo.upload_timestamp).toLocaleString()}</p>
                        </div>
                    </div>
                    
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">Classification</h4>
                        <div class="bg-background-100 p-3 rounded">
                            <p><strong>Document Type:</strong> ${formatDocumentType(docInfo.document_type)}</p>
                            <p><strong>Contains Criteria:</strong> ${docInfo.contains_criteria ? 'Yes' : 'No'}</p>
                            <p><strong>Confidence:</strong> ${Math.round((docInfo.classification_confidence || 0) * 100)}%</p>
                            ${docInfo.criteria_count ? `<p><strong>Criteria Count:</strong> ${docInfo.criteria_count}</p>` : ''}
                        </div>
                    </div>
                    
                    ${docInfo.word_count ? `
                    <div>
                        <h4 class="text-base font-medium text-foreground-900 mb-2">Content Statistics</h4>
                        <div class="bg-background-100 p-3 rounded">
                            <p><strong>Word Count:</strong> ${docInfo.word_count.toLocaleString()}</p>
                            <p><strong>Text Length:</strong> ${docInfo.extracted_text_length?.toLocaleString() || 'N/A'} characters</p>
                        </div>
                    </div>
                    ` : ''}
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(detailsModal);
    setTimeout(() => detailsModal.classList.add('show'), 10);
};

window.removeDocument = function(documentId) {
    const uploadedFile = uploadedFiles.find(f => f.documentId === documentId);
    if (!uploadedFile) {
        showNotification('Document not found', 'error');
        return;
    }
    
    if (confirm(`Remove ${uploadedFile.file.name} from the upload list?`)) {
        // Remove from uploaded files array
        const index = uploadedFiles.indexOf(uploadedFile);
        if (index > -1) {
            uploadedFiles.splice(index, 1);
        }
        
        // Remove the file card from DOM
        const fileCard = document.querySelector(`[data-document-id="${documentId}"]`);
        if (fileCard) {
            fileCard.remove();
        }
        
        // Update counters
        updateFileCount();
        
        // Show placeholder if no files remain
        if (uploadedFiles.length === 0) {
            const uploadPlaceholder = document.getElementById('upload-placeholder');
            if (uploadPlaceholder) {
                uploadPlaceholder.style.display = 'flex';
            }
        }
        
        showNotification(`Removed ${uploadedFile.file.name}`, 'info');
    }
};