document.addEventListener('DOMContentLoaded', () => {
    const logoutBtn = document.getElementById('logoutBtn');
    const newCampaignBtn = document.getElementById('newCampaignBtn');
    const newCampaignModal = document.getElementById('newCampaignModal');
    const newCampaignForm = document.getElementById('newCampaignForm');
    const cancelCampaignBtn = document.getElementById('cancelCampaign');
    const campaignsList = document.getElementById('campaignsList');
    const campaignTypeSelect = document.getElementById('campaignType');
    const templateFieldsContainer = document.getElementById('templateFields');
    const responseMessagePreview = document.getElementById('responseMessagePreview');

    import('./campaignTemplates.js').then(module => {
        const { campaignTemplates } = module;

        // Populate campaign type select
        campaignTypeSelect.innerHTML = Object.entries(campaignTemplates)
            .map(([value, template]) => `
                <option value="${value}">${template.name}</option>
            `).join('');

        // Handle campaign type change
        campaignTypeSelect.addEventListener('change', () => {
            const selectedTemplate = campaignTemplates[campaignTypeSelect.value];
            updateTemplateFields(selectedTemplate);
            updateMessagePreview();
        });

        // Initialize with first template
        updateTemplateFields(campaignTemplates[campaignTypeSelect.value]);
    });

    function updateTemplateFields(template) {
        templateFieldsContainer.innerHTML = template.fields.map(field => `
            <div class="space-y-2">
                <label for="${field.id}" class="block text-sm font-medium text-gray-700">
                    ${field.label}
                </label>
                ${generateFieldInput(field)}
            </div>
        `).join('');

        // Add event listeners to all template fields
        templateFieldsContainer.querySelectorAll('input, textarea, select').forEach(element => {
            element.addEventListener('input', updateMessagePreview);
        });
    }

    function generateFieldInput(field) {
        switch (field.type) {
            case 'select':
                return `
                    <select id="${field.id}" class="input mt-1 block w-full">
                        ${field.options.map(option => `
                            <option value="${option}">${option}</option>
                        `).join('')}
                    </select>
                `;
            case 'textarea':
                return `
                    <textarea id="${field.id}" 
                        class="input mt-1 block w-full" 
                        rows="3"
                        placeholder="${field.placeholder}"
                    ></textarea>
                `;
            default:
                return `
                    <input type="text" 
                        id="${field.id}" 
                        class="input mt-1 block w-full"
                        placeholder="${field.placeholder}"
                    >
                `;
        }
    }

    function updateMessagePreview() {
        const selectedTemplate = campaignTemplates[campaignTypeSelect.value];
        let message = selectedTemplate.template;
        
        // Replace all placeholders with field values
        selectedTemplate.fields.forEach(field => {
            const element = document.getElementById(field.id);
            const value = element ? element.value : '';
            message = message.replace(`{{${field.id}}}`, value);
        });

        message = message.replace('{{keyword}}', document.getElementById('keyword').value || '[KEYWORD]');
        responseMessagePreview.textContent = message;
        document.getElementById('responseMessage').value = message;
    }

    // Load user info
    fetch('/auth/user')
        .then(response => response.json())
        .then(user => {
            document.getElementById('username').textContent = `Welcome, ${user.username}!`;
        });

    // Load campaigns
    function loadCampaigns() {
        fetch('/api/campaigns')
            .then(response => response.json())
            .then(campaigns => {
                campaignsList.innerHTML = campaigns.map(campaign => `
                    <div class="card hover:shadow-lg transition-shadow duration-200">
                        <div class="flex justify-between items-start">
                            <h3 class="text-lg font-semibold text-gray-900">${campaign.name}</h3>
                            <span class="px-2 py-1 text-xs font-medium bg-primary-100 text-primary-800 rounded-full">
                                ${campaign.type}
                            </span>
                        </div>
                        <div class="mt-4 space-y-2">
                            <div class="flex items-center text-sm text-gray-600">
                                <svg class="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"/>
                                </svg>
                                Keyword: <strong class="ml-1 text-gray-900">${campaign.keyword}</strong>
                            </div>
                            <div class="text-sm text-gray-600">
                                <svg class="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"/>
                                </svg>
                                ${campaign.response_message}
                            </div>
                        </div>
                        <div class="mt-4 pt-4 border-t border-gray-200 text-sm text-gray-600">
                            Created: ${new Date(campaign.created_at).toLocaleDateString()}
                        </div>
                    </div>
                `).join('');
            });
    }

    loadCampaigns();

    // Event Listeners
    logoutBtn.addEventListener('click', () => {
        window.location.href = '/auth/logout';
    });

    newCampaignBtn.addEventListener('click', () => {
        newCampaignModal.classList.remove('hidden');
        updateMessagePreview();
    });

    cancelCampaignBtn.addEventListener('click', () => {
        newCampaignModal.classList.add('hidden');
        newCampaignForm.reset();
    });

    newCampaignForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = {
            name: document.getElementById('campaignName').value,
            keyword: document.getElementById('keyword').value,
            type: document.getElementById('campaignType').value,
            responseMessage: document.getElementById('responseMessage').value,
            templateData: {}
        };

        // Collect template field data
        const selectedTemplate = campaignTemplates[formData.type];
        selectedTemplate.fields.forEach(field => {
            const element = document.getElementById(field.id);
            if (element) {
                formData.templateData[field.id] = element.value;
            }
        });

        try {
            const response = await fetch('/api/campaigns', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(formData),
            });

            if (response.ok) {
                newCampaignModal.classList.add('hidden');
                newCampaignForm.reset();
                loadCampaigns();
            } else {
                const data = await response.json();
                alert(data.error || 'Failed to create campaign');
            }
        } catch (error) {
            alert('Failed to create campaign');
        }
    });

    // Close modal when clicking outside
    newCampaignModal.addEventListener('click', (e) => {
        if (e.target === newCampaignModal) {
            newCampaignModal.classList.add('hidden');
            newCampaignForm.reset();
        }
    });
});