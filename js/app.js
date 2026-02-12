// QR Code Generator Application

class QRGenerator {
    constructor() {
        this.currentMode = 'individual';
        this.qrDataCache = [];
        this.badgeTemplate = null;
        this.discTemplate = null;
        this.photoCache = new Map(); // Store photos by name for bulk mode
        this.countryFlagMap = new Map(); // Store country -> flag SVG filename mappings
        this.flagCache = new Map(); // Cache loaded flag SVG content
        this.supabaseClient = null; // Supabase client instance
        this.bulkData = null; // Store loaded data
        this.dataSource = 'none'; // Track where data came from: 'supabase', 'excel', or 'none'
        this.loadCountryFlagMappings();
        this.loadSupabaseConfig();
        this.loadTemplates();
        this.initializeEventListeners();
    }
    
    // Helper function to check if medical field indicates "No"
    hasMedicalInfo(value) {
        if (!value) return false;
        const trimmed = value.toString().trim().toLowerCase();
        if (!trimmed) return false;
        
        // List of responses that mean "No"
        const noResponses = ['none', 'n/a', 'no allergies', 'no conditions', 'no allergy', 'no condition'];
        return !noResponses.includes(trimmed);
    }
    
    async loadTemplates() {
        try {
            const badgeResponse = await fetch('assets/badge_template.svg');
            this.badgeTemplate = await badgeResponse.text();
            
            const discResponse = await fetch('assets/disc_template.svg');
            this.discTemplate = await discResponse.text();
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    
    loadCountryFlagMappings() {
        // Load saved mappings from localStorage
        const saved = localStorage.getItem('countryFlagMappings');
        if (saved) {
            try {
                const mappings = JSON.parse(saved);
                this.countryFlagMap = new Map(Object.entries(mappings));
                console.log('Loaded country-flag mappings:', this.countryFlagMap);
            } catch (error) {
                console.error('Error loading country-flag mappings:', error);
            }
        }
        
        // Populate dropdown after loading (use setTimeout to ensure DOM is ready)
        setTimeout(() => this.populateCountryDropdown(), 100);
    }
    
    saveCountryFlagMappings() {
        const mappings = Object.fromEntries(this.countryFlagMap);
        localStorage.setItem('countryFlagMappings', JSON.stringify(mappings));
        console.log('Saved country-flag mappings');
    }
    
    async loadFlagSvg(flagFilename) {
        if (!flagFilename) return null;
        
        // Check cache first
        if (this.flagCache.has(flagFilename)) {
            return this.flagCache.get(flagFilename);
        }
        
        try {
            const response = await fetch(`/assets/Flags/${flagFilename}`);
            if (!response.ok) {
                console.error(`Flag file not found: /assets/Flags/${flagFilename}`);
                return null;
            }
            const svgContent = await response.text();
            this.flagCache.set(flagFilename, svgContent);
            return svgContent;
        } catch (error) {
            console.error(`Error loading flag ${flagFilename}:`, error);
            return null;
        }
    }
    
    async resizeImage(file, maxWidth, maxHeight) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let width = img.width;
                    let height = img.height;
                    
                    // Calculate new dimensions maintaining aspect ratio
                    if (width > height) {
                        if (width > maxWidth) {
                            height = (height * maxWidth) / width;
                            width = maxWidth;
                        }
                    } else {
                        if (height > maxHeight) {
                            width = (width * maxHeight) / height;
                            height = maxHeight;
                        }
                    }
                    
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/png'));
                };
                img.onerror = reject;
                img.src = e.target.result;
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    initializeEventListeners() {
        // Mode switching
        document.getElementById('individualBtn').addEventListener('click', () => this.switchMode('individual'));
        document.getElementById('bulkBtn').addEventListener('click', () => this.switchMode('bulk'));

        // Individual mode
        document.getElementById('generateIndividualBtn').addEventListener('click', () => this.generateIndividual());
        document.getElementById('downloadBadgeBtn').addEventListener('click', () => this.downloadIndividual('badge'));
        document.getElementById('downloadDiscBtn').addEventListener('click', () => this.downloadIndividual('disc'));

        // Bulk mode
        document.getElementById('reloadXlsxBtn').addEventListener('click', () => this.loadXLSXFromAssets());
        document.getElementById('generateBulkBtn').addEventListener('click', () => this.generateBulk());
        document.getElementById('downloadAllBtn').addEventListener('click', () => this.downloadAll());
        
        // Photo folder functionality
        document.getElementById('usePhotosCheckbox').addEventListener('change', (e) => {
            const photoSection = document.getElementById('photoFolderSection');
            photoSection.style.display = e.target.checked ? 'block' : 'none';
            if (!e.target.checked) {
                this.photoCache.clear();
                document.getElementById('photoFolderStatus').style.display = 'none';
            }
        });
        
        document.getElementById('photoFolderUpload').addEventListener('change', (e) => this.loadPhotosFromFolder(e));
        
        // Settings menu
        document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
        document.getElementById('closeSettings').addEventListener('click', () => this.closeSettings());
        document.getElementById('addCountryBtn').addEventListener('click', () => this.addCountryMapping());
        document.getElementById('browseFlagBtn').addEventListener('click', () => this.browseFlagFile());
        document.getElementById('flagFileInput').addEventListener('change', (e) => this.handleFlagFileSelection(e));
        document.getElementById('settingsModal').addEventListener('click', (e) => {
            if (e.target.id === 'settingsModal') this.closeSettings();
        });
        
        // Supabase configuration loaded from conf.json (no UI controls)
    }

    populateCountryDropdown() {
        const countrySelect = document.getElementById('country');
        if (!countrySelect) return;
        
        // Clear existing options except the placeholder
        countrySelect.innerHTML = '<option value="">Select country...</option>';
        
        // Add option for each country in the mappings
        for (const [country, flagFile] of this.countryFlagMap.entries()) {
            const option = document.createElement('option');
            option.value = country;
            option.textContent = country;
            countrySelect.appendChild(option);
        }
    }
    
    switchMode(mode) {
        this.currentMode = mode;

        // Update button states
        document.getElementById('individualBtn').classList.toggle('active', mode === 'individual');
        document.getElementById('bulkBtn').classList.toggle('active', mode === 'bulk');

        // Update panel visibility
        document.getElementById('individualMode').classList.toggle('active', mode === 'individual');
        document.getElementById('bulkMode').classList.toggle('active', mode === 'bulk');
        
        // Auto-load xlsx file when switching to bulk mode
        if (mode === 'bulk' && !this.bulkData) {
            this.loadXLSXFromAssets();
        }
    }
    
    openSettings() {
        this.updateSettingsList();
        document.getElementById('settingsModal').style.display = 'flex';
    }
    
    closeSettings() {
        document.getElementById('settingsModal').style.display = 'none';
        document.getElementById('countryName').value = '';
        document.getElementById('flagFilename').value = '';
    }
    
    // Supabase configuration is loaded from conf.json (no UI population needed)
    
    updateSettingsList() {
        const list = document.getElementById('countryMappingsList');
        list.innerHTML = '';
        
        if (this.countryFlagMap.size === 0) {
            list.innerHTML = '<p style="color: #666; font-style: italic;">No country-flag mappings configured yet.</p>';
            return;
        }
        
        this.countryFlagMap.forEach((flagFilename, country) => {
            const item = document.createElement('div');
            item.className = 'mapping-item';
            item.innerHTML = `
                <span><strong>${country}</strong> → ${flagFilename}</span>
                <button onclick="app.deleteCountryMapping('${country}')" class="delete-btn">Delete</button>
            `;
            list.appendChild(item);
        });
        
        // Also update the country dropdown
        this.populateCountryDropdown();
    }
    
    addCountryMapping() {
        const countryName = document.getElementById('countryName').value.trim();
        const flagFilename = document.getElementById('flagFilename').value.trim();
        
        if (!countryName || !flagFilename) {
            alert('Please enter both country name and flag SVG filename');
            return;
        }
        
        // Validate that flag filename ends with .svg
        if (!flagFilename.toLowerCase().endsWith('.svg')) {
            alert('Flag filename must end with .svg');
            return;
        }
        
        // Store with trimmed country name to ensure exact matching
        this.countryFlagMap.set(countryName, flagFilename);
        this.saveCountryFlagMappings();
        this.updateSettingsList();
        
        // Clear inputs
        document.getElementById('countryName').value = '';
        document.getElementById('flagFilename').value = '';
        
        console.log(`Added mapping: "${countryName}" -> ${flagFilename}`);
        alert(`Successfully added mapping: ${countryName} → ${flagFilename}\n\nMake sure ${flagFilename} exists in assets/Flags/ folder.`);
    }
    
    deleteCountryMapping(country) {
        if (confirm(`Delete mapping for ${country}?`)) {
            this.countryFlagMap.delete(country);
            this.saveCountryFlagMappings();
            this.updateSettingsList();
        }
    }
    
    browseFlagFile() {
        // Trigger the hidden file input
        document.getElementById('flagFileInput').click();
    }
    
    handleFlagFileSelection(event) {
        const file = event.target.files[0];
        if (file) {
            // Validate it's an SVG file
            if (!file.name.toLowerCase().endsWith('.svg')) {
                alert('Please select an SVG file');
                event.target.value = ''; // Clear selection
                return;
            }
            
            // Set the filename in the text input
            document.getElementById('flagFilename').value = file.name;
            console.log('Selected flag file:', file.name);
            
            // Optionally, you could upload the file to assets folder here
            // For now, we just get the filename and assume user places it in assets/Flags/
            alert(`Selected: ${file.name}\n\nPlease make sure this file is placed in the assets/Flags/ folder.`);
        }
    }

    async generateIndividual() {
        // Get photo if uploaded
        const photoInput = document.getElementById('photoUpload');
        let photoDataUrl = null;
        
        if (photoInput.files && photoInput.files[0]) {
            photoDataUrl = await this.resizeImage(photoInput.files[0], 300, 300);
        }
        
        // Collect all form data
        const formData = {
            idNumber: document.getElementById('idNumber').value.trim(),
            name: document.getElementById('name').value.trim(),
            contactNumber: document.getElementById('contactNumber').value.trim(),
            iceContactName: document.getElementById('iceContactName').value.trim(),
            iceContactNumber: document.getElementById('iceContactNumber').value.trim(),
            medicalAidName: document.getElementById('medicalAidName').value.trim(),
            medicalAidNumber: document.getElementById('medicalAidNumber').value.trim(),
            medicalAidPlan: document.getElementById('medicalAidPlan').value.trim(),
            allergies: document.getElementById('allergies').value.trim(),
            medicalConditions: document.getElementById('medicalConditions').value.trim(),
            startingDate: document.getElementById('startingDate').value.trim(),
            membershipNumber: document.getElementById('membershipNumber').value.trim(),
            position: document.getElementById('position').value.trim(),
            rank: document.getElementById('rank').value.trim(),
            vehicleMake: document.getElementById('vehicleMake').value.trim(),
            vehicleModel: document.getElementById('vehicleModel').value.trim(),
            vehicleColor: document.getElementById('vehicleColor').value.trim(),
            vehicleRegistration: document.getElementById('vehicleRegistration').value.trim(),
            country: document.getElementById('country').value.trim()
        };

        const type = document.getElementById('individualType').value;

        // Validate required fields
        const requiredFields = ['idNumber', 'name', 'contactNumber', 'iceContactName', 'iceContactNumber', 'startingDate', 'membershipNumber', 'position', 'country'];
        const missingFields = requiredFields.filter(field => !formData[field]);
        
        if (missingFields.length > 0) {
            alert('Please fill in all required fields marked with *');
            return;
        }

        // Name field now contains full name (first and last)
        const fullName = formData.name;
        
        // Fields 1-10 for badge QR code (personal, emergency, medical info)
        const qrCodeData = {
            idNumber: formData.idNumber,
            name: formData.name,
            contactNumber: formData.contactNumber,
            iceContactName: formData.iceContactName,
            iceContactNumber: formData.iceContactNumber,
            medicalAidName: formData.medicalAidName,
            medicalAidNumber: formData.medicalAidNumber,
            medicalAidPlan: formData.medicalAidPlan,
            allergies: this.hasMedicalInfo(formData.allergies) ? 'Yes' : 'No',
            medicalConditions: this.hasMedicalInfo(formData.medicalConditions) ? 'Yes' : 'No'
        };
        
        // Fields 11-14 for badge display (work info)
        const badgeDisplayInfo = {
            name: formData.name,
            startingDate: formData.startingDate,
            membershipNumber: formData.membershipNumber,
            position: formData.position,
            rank: formData.rank
        };
        
        // Fields 16-19 for vehicle info
        const vehicleInfo = {
            vehicleMake: formData.vehicleMake,
            vehicleModel: formData.vehicleModel,
            vehicleRegistration: formData.vehicleRegistration
        };
        
        // Fields 1-14 for disc QR code (personal, emergency, medical + vehicle info)
        const discQrCodeData = {
            idNumber: formData.idNumber,
            name: formData.name,
            contactNumber: formData.contactNumber,
            iceContactName: formData.iceContactName,
            iceContactNumber: formData.iceContactNumber,
            medicalAidName: formData.medicalAidName,
            medicalAidNumber: formData.medicalAidNumber,
            medicalAidPlan: formData.medicalAidPlan,
            allergies: this.hasMedicalInfo(formData.allergies) ? 'Yes' : 'No',
            medicalConditions: this.hasMedicalInfo(formData.medicalConditions) ? 'Yes' : 'No',
            vehicleMake: formData.vehicleMake,
            vehicleModel: formData.vehicleModel,
            vehicleRegistration: formData.vehicleRegistration
        };
        
        // Build full payloads from available fields so all information is included
        const preferredOrder = [
            'idNumber','name','contactNumber','iceContactName','iceContactSurname','iceContactNumber',
            'medicalAidName','medicalAidNumber','medicalAidPlan','allergies','medicalConditions',
            'startingDate','membershipNumber','position','rank','vehicleMake','vehicleModel','vehicleRegistration','country'
        ];

        // Badge QR: Custom format with selective labels
        const qrPayload = this.buildBadgeQRPayload(qrCodeData);

        // Disc QR: Custom format with selective labels plus vehicle info
        const discPayload = this.buildDiscQRPayload(discQrCodeData);

        console.log('Individual Badge QR payload (CRLF):', qrPayload);
        console.log('Individual Disc QR payload (CRLF):', discPayload);

        // Clear previous previews
        document.getElementById('badgePreview').innerHTML = '';
        document.getElementById('discPreview').innerHTML = '';

        // Generate based on type
        if (type === 'badge' || type === 'both') {
            await this.createBadge(fullName, qrPayload, null, 'badgePreview', badgeDisplayInfo, photoDataUrl, formData.country);
        }

        if (type === 'disc' || type === 'both') {
            await this.createDisc(fullName, discPayload, null, 'discPreview', vehicleInfo, formData.country);
        }

        // Show preview section
        document.getElementById('individualPreview').style.display = 'block';

        // Update download buttons visibility
        document.getElementById('downloadBadgeBtn').style.display = (type === 'badge' || type === 'both') ? 'inline-block' : 'none';
        document.getElementById('downloadDiscBtn').style.display = (type === 'disc' || type === 'both') ? 'inline-block' : 'none';
    }

    // Step 1: Generate QR code as PNG
    async generateQRCodePNG(data, size) {
        console.log('Step 1: Generating QR code as PNG, size:', size, 'Data length:', data.length);
        
        const qrContainer = document.createElement('div');
        qrContainer.style.position = 'absolute';
        qrContainer.style.left = '-9999px';
        qrContainer.style.top = '-9999px';
        document.body.appendChild(qrContainer);
        
        const qr = new QRCode(qrContainer, {
            text: data,
            width: size,
            height: size,
            colorDark: "#7851A9",  // Royal purple
            colorLight: "#ffffff",
            correctLevel: QRCode.CorrectLevel.H
        });
        
        // Wait for QR code to be generated
        await new Promise(resolve => setTimeout(resolve, 200));
        
        // Extract the QR code canvas or image that QRCode.js created
        const qrElement = qrContainer.querySelector('canvas') || qrContainer.querySelector('img');
        
        // Create our own properly-sized canvas and draw the QR code onto it
        const qrCanvas = document.createElement('canvas');
        qrCanvas.width = size;
        qrCanvas.height = size;
        const ctx = qrCanvas.getContext('2d');
        
        if (qrElement.tagName === 'CANVAS') {
            ctx.drawImage(qrElement, 0, 0, size, size);
        } else {
            // If it's an img element, wait for it to load
            await new Promise((resolve) => {
                if (qrElement.complete) {
                    ctx.drawImage(qrElement, 0, 0, size, size);
                    resolve();
                } else {
                    qrElement.onload = () => {
                        ctx.drawImage(qrElement, 0, 0, size, size);
                        resolve();
                    };
                }
            });
        }
        
        const qrDataUrl = qrCanvas.toDataURL('image/png');
        console.log('QR PNG generated, data URL length:', qrDataUrl.length);
        
        // Clean up: remove the temporary container from DOM
        document.body.removeChild(qrContainer);
        
        return qrDataUrl;
    }

    // Build Badge QR payload with exact format specification
    buildBadgeQRPayload(data) {
        const lines = [];
        
        // 1. Name (no label)
        if (data.name) lines.push(data.name);
        
        // 2. ID Number (no label)
        if (data.idNumber) lines.push(data.idNumber);
        
        // 3. Contact Number (no label)
        if (data.contactNumber) lines.push(data.contactNumber);
        
        // 4. "ICE:" + ICE Name
        if (data.iceContactName) lines.push(`ICE: ${data.iceContactName}`);
        
        // 5. "ICE No.:" + ICE contact number
        if (data.iceContactNumber) lines.push(`ICE No.: ${data.iceContactNumber}`);
        
        // 6. "MED AID:" + medical aid name
        if (data.medicalAidName) lines.push(`MED AID: ${data.medicalAidName}`);
        
        // 7. Medical aid plan (no label)
        if (data.medicalAidPlan) lines.push(data.medicalAidPlan);
        
        // 8. Medical aid number (no label)
        if (data.medicalAidNumber) lines.push(data.medicalAidNumber);
        
        // 9. "Allergies:" + yes/no
        lines.push(`Allergies: ${data.allergies || 'No'}`);
        
        // 10. "Medical conditions:" + yes/no
        lines.push(`Medical conditions: ${data.medicalConditions || 'No'}`);
        
        return lines.join('\n');
    }
    
    // Build Disc QR payload with exact format specification
    buildDiscQRPayload(data) {
        const lines = [];
        
        // 1. Name (no label)
        if (data.name) lines.push(data.name);
        
        // 2. Contact Number (no label)
        if (data.contactNumber) lines.push(data.contactNumber);
        
        // 3. "ICE:" + ICE Name
        if (data.iceContactName) lines.push(`ICE: ${data.iceContactName}`);
        
        // 4. "ICE No.:" + ICE contact number
        if (data.iceContactNumber) lines.push(`ICE No.: ${data.iceContactNumber}`);
        
        // 5. "MED AID:" + medical aid name
        if (data.medicalAidName) lines.push(`MED AID: ${data.medicalAidName}`);
        
        // 6. Medical aid plan (no label)
        if (data.medicalAidPlan) lines.push(data.medicalAidPlan);
        
        // 7. Medical aid number (no label)
        if (data.medicalAidNumber) lines.push(data.medicalAidNumber);
        
        // 8. "Allergies:" + yes/no
        lines.push(`Allergies: ${data.allergies || 'No'}`);
        
        // 9. "Medical conditions:" + yes/no
        lines.push(`Medical conditions: ${data.medicalConditions || 'No'}`);
        
        // 10. "Vehicle Info:" + vehicle make
        if (data.vehicleMake) lines.push(`Vehicle Info: ${data.vehicleMake}`);
        
        // 11. Vehicle model (no label)
        if (data.vehicleModel) lines.push(data.vehicleModel);
        
        // 12. Vehicle registration (no label)
        if (data.vehicleRegistration) lines.push(data.vehicleRegistration);
        
        return lines.join('\n');
    }

    // Build a plain-text payload from an object containing fields.
    // Uses a preferred key order, then appends any remaining keys.
    buildPlainTextPayloadFromObject(obj, preferredOrder = []) {
        const labelMap = {
            idNumber: 'ID',
            name: 'Full Name',
            contactNumber: 'Contact Number',
            iceContactName: 'ICE Contact Name',
            iceContactSurname: 'ICE Contact Surname',
            iceContactNumber: 'ICE Contact Number',
            medicalAidName: 'Medical Aid Name',
            medicalAidNumber: 'Medical Aid Number',
            medicalAidPlan: 'Medical Aid Plan',
            allergies: 'Allergies',
            medicalConditions: 'Medical Conditions',
            startingDate: 'Starting Date',
            membershipNumber: 'Membership Number',
            position: 'Position',
            rank: 'Rank',
            vehicleMake: 'Vehicle Make',
            vehicleModel: 'Vehicle Model',
            vehicleRegistration: 'Vehicle Registration',
            country: 'Country'
        };

        const lines = [];
        const used = new Set();

        for (const key of preferredOrder) {
            if (Object.prototype.hasOwnProperty.call(obj, key)) {
                const val = obj[key] === undefined || obj[key] === null ? '' : String(obj[key]);
                const label = labelMap[key] || key;
                lines.push(`${label}: ${val}`);
                used.add(key);
            }
        }

        // Append any remaining keys in stable order
        Object.keys(obj).sort().forEach(key => {
            if (used.has(key)) return;
            const val = obj[key] === undefined || obj[key] === null ? '' : String(obj[key]);
            const label = labelMap[key] || key;
            lines.push(`${label}: ${val}`);
            used.add(key);
        });

        // Use LF newlines (previous behavior) to match earlier working payloads
        return lines.join('\n');
    }

    

    async createBadge(name, data, qrSize, containerId, displayInfo = null, photoDataUrl = null, country = null) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<h4>Badge (using template)</h4>';
        
        if (!this.badgeTemplate) {
            container.innerHTML += '<p>Loading template...</p>';
            return;
        }
        
        console.log('Creating badge for:', name, 'Country:', country);
        console.log('Photo data URL provided:', photoDataUrl ? 'YES (length: ' + photoDataUrl.length + ')' : 'NO');
        
        // Create a parser to work with the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(this.badgeTemplate, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        
        // Get QR size from the first QR placeholder if qrSize not provided
        // Use larger size for better quality
        if (!qrSize) {
            const qrb1 = svgDoc.getElementById('QRB1');
            if (qrb1) {
                const bbox = qrb1.getBBox();
                qrSize = Math.max(bbox.width, bbox.height) * 4; // 4x scale for quality
                
                // Path elements return zero bbox, use calculated coordinates
                if (qrSize === 0) {
                    qrSize = 628; // 157 * 4 (badge width)
                }
            } else {
                qrSize = 628; // fallback to calculated size
            }
        }
        
        console.log('Badge QR size for generation:', qrSize);
        
        // Step 1: Generate QR code as PNG first
        const qrDataUrl = await this.generateQRCodePNG(data, qrSize);
        
        console.log('Step 2: Placing QR PNG on SVG template');
        console.log('Looking for QRB1 and QRB2 placeholders...');
        
        // Find and replace QRB1 placeholder with QR code
        const qrb1 = svgDoc.getElementById('QRB1');
        console.log('Found QRB1:', !!qrb1);
        if (qrb1) {
            // QR placeholders are path elements - use dimensions from actual SVG
            const bbox = qrb1.getBBox();
            console.log('QRB1 bbox:', bbox);
            
            let x, y, width, height;
            // Based on SVG path: M 352.50965,-475.41942 H 961.02524 V 71.081871 H 352.50965 Z
            x = 352.50965;    // From path definition
            y = -475.41942;   // From path definition
            width = 608.51559; // 961.02524 - 352.50965
            height = 546.501291; // 71.081871 - (-475.41942)
            console.log('Using calculated badge coordinates for QRB1:', {x, y, width, height});
            
            const image1 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
            image1.setAttribute('href', qrDataUrl);
            image1.setAttributeNS('http://www.w3.org/1999/xlink', 'href', qrDataUrl);
            image1.setAttribute('x', x);
            image1.setAttribute('y', y);
            image1.setAttribute('width', width);
            image1.setAttribute('height', height);
            image1.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            image1.setAttribute('id', 'QRB1-filled');
            qrb1.parentNode.replaceChild(image1, qrb1);
            console.log('Replaced QRB1 with QR image, data URL starts with:', qrDataUrl.substring(0, 30));
        }
        
        // Find and replace QRB2 placeholder with QR code
        const qrb2 = svgDoc.getElementById('QRB2');
        console.log('Found QRB2:', !!qrb2);
        if (qrb2) {
            // Get dimensions from attributes if getBBox returns 0
            const bbox = qrb2.getBBox();
            console.log('QRB2 bbox:', bbox);
            
            let x, y, width, height;
            // Based on SVG path: m 2154.9928,1815.0152 h 608.3699 v 573.3398 h -608.3699 z
            x = 2154.9928;   // From path definition
            y = 1815.0152;   // From path definition
            width = 608.3699; // From path (h value)
            height = 573.3398; // From path (v value)
            console.log('Using calculated badge coordinates for QRB2:', {x, y, width, height});
            
            const image2 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
            image2.setAttribute('href', qrDataUrl);
            image2.setAttributeNS('http://www.w3.org/1999/xlink', 'href', qrDataUrl);
            image2.setAttribute('x', x);
            image2.setAttribute('y', y);
            image2.setAttribute('width', width);
            image2.setAttribute('height', height);
            image2.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            image2.setAttribute('id', 'QRB2-filled');
            qrb2.parentNode.replaceChild(image2, qrb2);
            console.log('Replaced QRB2 with QR image, data URL starts with:', qrDataUrl.substring(0, 30));
        }
        
        // Find and replace PB1 placeholder with photo if provided
        if (photoDataUrl) {
            console.log('Processing PB1 placeholder with photo...');
            const pb1 = svgDoc.getElementById('PB1');
            console.log('PB1 element found:', !!pb1);
            if (pb1) {
                const bbox = pb1.getBBox();
                console.log('PB1 bounding box:', bbox);
                
                // Manually extract coordinates from path data since getBBox returns zeros
                // Path: M 561.42716,418.3492 H 950.38471 V 912.3253 H 561.42716 Z
                const x = 561.42716;
                const y = 418.3492;
                const width = 950.38471 - 561.42716;  // 388.95755
                const height = 912.3253 - 418.3492;   // 493.9761
                console.log('Using calculated badge coordinates for PB1:', {x, y, width, height});
                
                const photoImage1 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                photoImage1.setAttributeNS('http://www.w3.org/1999/xlink', 'href', photoDataUrl);
                photoImage1.setAttribute('x', x);
                photoImage1.setAttribute('y', y);
                photoImage1.setAttribute('width', width);
                photoImage1.setAttribute('height', height);
                photoImage1.setAttribute('id', 'PB1-filled');
                photoImage1.setAttribute('preserveAspectRatio', 'none');
                pb1.parentNode.replaceChild(photoImage1, pb1);
                console.log('PB1 replaced with photo image');
            }
            
            // Find and replace PB2 placeholder with photo
            console.log('Processing PB2 placeholder with photo...');
            const pb2 = svgDoc.getElementById('PB2');
            console.log('PB2 element found:', !!pb2);
            if (pb2) {
                const bbox = pb2.getBBox();
                console.log('PB2 bounding box:', bbox);
                
                // Manually extract coordinates from path data since getBBox returns zeros
                // Path: m 1182.2103,2156.4435 h 326.7244 v 435.6325 h -326.7244 z
                const x = 1182.2103;
                const y = 2156.4435;
                const width = 326.7244;
                const height = 435.6325;
                console.log('Using calculated badge coordinates for PB2:', {x, y, width, height});
                
                const photoImage2 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                photoImage2.setAttributeNS('http://www.w3.org/1999/xlink', 'href', photoDataUrl);
                photoImage2.setAttribute('x', x);
                photoImage2.setAttribute('y', y);
                photoImage2.setAttribute('width', width);
                photoImage2.setAttribute('height', height);
                photoImage2.setAttribute('id', 'PB2-filled');
                photoImage2.setAttribute('preserveAspectRatio', 'none');
                pb2.parentNode.replaceChild(photoImage2, pb2);
                console.log('PB2 replaced with photo image');
            }
        } else {
            console.log('No photo data URL provided, PB1 and PB2 placeholders will remain visible');
            // Placeholders remain unchanged - they will be visible as outlined rectangles in the output
            const pb1 = svgDoc.getElementById('PB1');
            const pb2 = svgDoc.getElementById('PB2');
            if (pb1) {
                console.log('PB1 placeholder preserved in SVG');
            }
            if (pb2) {
                console.log('PB2 placeholder preserved in SVG');
            }
        }
        
        // Replace flag placeholders PHF1 and PHF2 with country flag if country is provided
        if (country) {
            console.log(`Processing flag placeholders for country: ${country}`);
            const flagFilename = this.countryFlagMap.get(country);
            
            if (flagFilename) {
                console.log(`Loading flag SVG: ${flagFilename}`);
                const flagSvgContent = await this.loadFlagSvg(flagFilename);
                
                if (flagSvgContent) {
                    // Convert flag SVG to data URL
                    const flagDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(flagSvgContent)));
                    
                    // Replace PHF1 placeholder
                    // Path: m 918.31811,2420.2032 h 242.67909 v 171.7762 H 918.31811 Z
                    const phf1 = svgDoc.getElementById('PHF1');
                    if (phf1) {
                        const phf1_x = 918.31811;
                        const phf1_y = 2420.2032;
                        const phf1_width = 242.67909;
                        const phf1_height = 171.7762;
                        
                        console.log('PHF1 coordinates:', {x: phf1_x, y: phf1_y, width: phf1_width, height: phf1_height});
                        
                        // Create image element with flag
                        const flagImage1 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                        flagImage1.setAttribute('href', flagDataUrl);
                        flagImage1.setAttributeNS('http://www.w3.org/1999/xlink', 'href', flagDataUrl);
                        flagImage1.setAttribute('x', phf1_x);
                        flagImage1.setAttribute('y', phf1_y);
                        flagImage1.setAttribute('width', phf1_width);
                        flagImage1.setAttribute('height', phf1_height);
                        flagImage1.setAttribute('preserveAspectRatio', 'none');
                        flagImage1.setAttribute('id', 'PHF1-filled');
                        
                        phf1.parentNode.replaceChild(flagImage1, phf1);
                        console.log('Replaced PHF1 with flag');
                    }
                    
                    // Replace PHF2 placeholder
                    // Path: m 718.77918,1477.2516 h 242.67906 v 171.7761 H 718.77918 Z
                    const phf2 = svgDoc.getElementById('PHF2');
                    if (phf2) {
                        const phf2_x = 718.77918;
                        const phf2_y = 1477.2516;
                        const phf2_width = 242.67906;
                        const phf2_height = 171.7761;
                        
                        console.log('PHF2 coordinates:', {x: phf2_x, y: phf2_y, width: phf2_width, height: phf2_height});
                        
                        const flagImage2 = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                        flagImage2.setAttribute('href', flagDataUrl);
                        flagImage2.setAttributeNS('http://www.w3.org/1999/xlink', 'href', flagDataUrl);
                        flagImage2.setAttribute('x', phf2_x);
                        flagImage2.setAttribute('y', phf2_y);
                        flagImage2.setAttribute('width', phf2_width);
                        flagImage2.setAttribute('height', phf2_height);
                        flagImage2.setAttribute('preserveAspectRatio', 'none');
                        flagImage2.setAttribute('id', 'PHF2-filled');
                        
                        phf2.parentNode.replaceChild(flagImage2, phf2);
                        console.log('Replaced PHF2 with flag');
                    }
                } else {
                    console.warn(`Flag SVG file ${flagFilename} not found or failed to load`);
                }
            } else {
                console.warn(`No flag mapping found for country: ${country}`);
            }
        }
        
        // Update text fields with actual values if displayInfo is provided
        if (displayInfo) {
            // Calculate expiry date: always 31/12, with year logic based on current month
            const today = new Date();
            const currentMonth = today.getMonth(); // 0-11 (0 = January, 11 = December)
            const currentYear = today.getFullYear();
            
            // If current month is December (11), use next year; otherwise use current year
            const expiryYear = currentMonth === 11 ? currentYear + 1 : currentYear;
            
            // Format as DD/MM/YYYY for display
            const expiryDateStr = `31/12/${expiryYear}`;
            
            // Find and update all text elements
            const textElements = svgDoc.getElementsByTagName('text');
            for (let i = 0; i < textElements.length; i++) {
                const textElement = textElements[i];
                const textContent = textElement.textContent.trim();
                
                // Helper function to update text while preserving structure and alignment
                const updateTextContent = (element, newText) => {
                    // Find the tspan and update only the text content, leaving all attributes intact
                    const tspan = element.querySelector('tspan');
                    if (tspan) {
                        tspan.textContent = newText;
                    } else if (element.firstChild && element.firstChild.nodeType === 3) {
                        // Direct text node
                        element.firstChild.textContent = newText;
                    } else {
                        element.textContent = newText;
                    }
                };
                
                // Replace "name surname" with actual full name
                if (textContent.toLowerCase() === 'name surname' || textContent === 'name surname') {
                    if (displayInfo && displayInfo.name) {
                        // Use full name from displayInfo
                        updateTextContent(textElement, displayInfo.name);
                    } else {
                        // Fallback to full name parameter
                        updateTextContent(textElement, name);
                    }
                }
                
                // Update "MemberNo:" to "Member No: [value]"
                if ((textContent.includes('MemberNo:') || textContent.includes('Member No:')) && displayInfo.membershipNumber) {
                    updateTextContent(textElement, `Member No: ${displayInfo.membershipNumber}`);
                }
                
                // Update "Joined:" to "Joined: [value]"
                if (textContent.includes('Joined:') && displayInfo.startingDate) {
                    updateTextContent(textElement, `Joined: ${displayInfo.startingDate}`);
                }
                
                // Update "Card Expires:" to "Card Expires: [date]"
                if (textContent.includes('Card Expires:') || textContent.includes('Cardexpires:')) {
                    updateTextContent(textElement, `Card Expires: ${expiryDateStr}`);
                }
                
                // Replace "Position" text with actual position value
                if (textContent === 'Position' && displayInfo.position) {
                    updateTextContent(textElement, displayInfo.position);
                }
                
                // Replace "Rank" text with actual rank values (split by comma, max 5 ranks on separate lines)
                if (textContent === 'Rank' && displayInfo.rank) {
                    const rankLower = displayInfo.rank.toLowerCase().trim();
                    // Hide rank text if it's "none", "n/a", or empty
                    if (rankLower === 'none' || rankLower === 'n/a' || rankLower === '') {
                        textElement.style.display = 'none';
                        textElement.setAttribute('visibility', 'hidden');
                    } else {
                        const ranks = displayInfo.rank.split(',').map(r => r.trim()).filter(r => r.length > 0);
                        const ranksToDisplay = ranks.slice(0, 5); // Max 5 ranks
                        
                        // For multiple ranks, create tspan elements with line breaks
                        const existingTspan = textElement.querySelector('tspan');
                        if (existingTspan && ranksToDisplay.length > 1) {
                            const x = existingTspan.getAttribute('x');
                            const y = existingTspan.getAttribute('y');
                            const style = existingTspan.getAttribute('style');
                            const id = existingTspan.getAttribute('id');
                            const role = existingTspan.getAttribute('sodipodi:role');
                            
                            // Clear existing content
                            textElement.innerHTML = '';
                            
                            // Create tspan for each rank
                            ranksToDisplay.forEach((rank, index) => {
                                const newTspan = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                                newTspan.textContent = rank;
                                newTspan.setAttribute('x', x);
                                if (index === 0) {
                                    newTspan.setAttribute('y', y);
                                    if (id) newTspan.setAttribute('id', id);
                                    if (role) newTspan.setAttribute('sodipodi:role', role);
                                } else {
                                    newTspan.setAttribute('dy', '1.2em'); // Line spacing
                                }
                                if (style) newTspan.setAttribute('style', style);
                                textElement.appendChild(newTspan);
                            });
                        } else {
                            // Single rank or no tspan structure
                            updateTextContent(textElement, ranksToDisplay[0]);
                        }
                    }
                } else if (textContent === 'Rank' && !displayInfo.rank) {
                    // Also hide if no rank data provided
                    textElement.style.display = 'none';
                    textElement.setAttribute('visibility', 'hidden');
                }
            }
        }
        
        // Replace "country" text element with actual country value
        if (country) {
            const textElements = svgDoc.getElementsByTagName('text');
            for (let i = 0; i < textElements.length; i++) {
                const textElement = textElements[i];
                const textContent = textElement.textContent.trim().toLowerCase();
                const elementId = textElement.getAttribute('id');
                
                // Match by id="country" or text content="country"
                if (elementId === 'country' || textContent === 'country') {
                    console.log(`Replacing country text with: ${country}`);
                    const tspan = textElement.querySelector('tspan');
                    if (tspan) {
                        tspan.textContent = country;
                    } else if (textElement.firstChild && textElement.firstChild.nodeType === 3) {
                        textElement.firstChild.textContent = country;
                    } else {
                        textElement.textContent = country;
                    }
                    // Continue to replace all instances, don't break
                }
            }
        }
        
        // Convert back to string and display
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgDoc);
        
        console.log('Step 3: SVG with QR PNG embedded ready for display');
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        wrapper.style.maxWidth = '100%';
        wrapper.style.overflow = 'auto';
        container.appendChild(wrapper);
        
        // Store reference for download
        wrapper.dataset.svgContent = svgString;
        
        console.log('Badge SVG with embedded PNG QR codes created successfully');
        
        return wrapper;
    }

    async createDisc(name, data, qrSize, containerId, vehicleInfo = null, country = null) {
        const container = document.getElementById(containerId);
        container.innerHTML = '<h4>Disc (using template)</h4>';
        
        if (!this.discTemplate) {
            container.innerHTML += '<p>Loading template...</p>';
            return;
        }
        
        console.log('Creating disc for:', name, 'Country:', country);
        
        // Create a parser to work with the SVG
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(this.discTemplate, 'image/svg+xml');
        const svgElement = svgDoc.documentElement;
        
        // Get QR size from the placeholder if qrSize not provided
        // Use larger size for better quality in disc template
        if (!qrSize) {
            const phqr = svgDoc.getElementById('PHQR');
            if (phqr) {
                const bbox = phqr.getBBox();
                qrSize = Math.max(bbox.width, bbox.height) * 30; // 30x scale for maximum print quality
                
                // Path elements return zero bbox, use calculated coordinates
                if (qrSize === 0) {
                    qrSize = 960; // 32 * 30 (PHQR width from disc) - maximum res for printing
                }
            } else {
                qrSize = 960; // fallback to maximum quality size
            }
        }
        
        console.log('Disc QR size for generation:', qrSize);
        
        // Step 1: Generate QR code as PNG first
        const qrDataUrl = await this.generateQRCodePNG(data, qrSize);
        
        console.log('Step 2: Placing QR PNG on disc SVG template');
        
        // Find and replace PHQR placeholder with QR code
        const phqr = svgDoc.getElementById('PHQR');
        if (phqr) {
            // PHQR is a path element with coordinates from d="m 48.718242,175.61896 32.613481,-0.0609..."
            // This is a relative path starting at (48.718242, 175.61896), width ~32.61, height ~31.90
            let x, y, width, height;
            x = 48.718242;      // Left edge from path
            y = 143.71721;      // Top edge (175.61896 - 31.90175)
            width = 32.613481;  // Width from path
            height = 31.90175;  // Height from path
            console.log('PHQR disc coordinates from path:', {x, y, width, height});
            
            const image = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
            image.setAttribute('href', qrDataUrl);
            image.setAttributeNS('http://www.w3.org/1999/xlink', 'href', qrDataUrl);
            image.setAttribute('x', x);
            image.setAttribute('y', y);
            image.setAttribute('width', width);
            image.setAttribute('height', height);
            image.setAttribute('preserveAspectRatio', 'none');
            image.setAttribute('id', 'PHQR-filled');
            phqr.parentNode.replaceChild(image, phqr);
            console.log('Replaced PHQR with QR image, data URL starts with:', qrDataUrl.substring(0, 30));
        }
        
        // Replace flag placeholder PHF with country flag if country is provided
        if (country) {
            console.log(`Processing PHF flag placeholder for country: ${country}`);
            const flagFilename = this.countryFlagMap.get(country);
            
            if (flagFilename) {
                console.log(`Loading flag SVG: ${flagFilename}`);
                const flagSvgContent = await this.loadFlagSvg(flagFilename);
                
                if (flagSvgContent) {
                    // Convert flag SVG to data URL
                    const flagDataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(flagSvgContent)));
                    
                    const phf = svgDoc.getElementById('PHF');
                    if (phf) {
                        // Path: m 37.049837,146.51217 -0.186294,-14.37718 10.176637,-0.13184 0.186293,14.37717 z
                        // This is a rectangle: x=37.049837, y=132.13499 (146.51217-14.37718), width=10.176637, height=14.37718
                        const phf_x = 37.049837;
                        const phf_y = 132.13499;  // 146.51217 - 14.37718
                        const phf_width = 10.176637;
                        const phf_height = 14.37718;
                        
                        console.log('PHF coordinates:', {x: phf_x, y: phf_y, width: phf_width, height: phf_height});
                        
                        // Create image element with flag
                        const flagImage = svgDoc.createElementNS('http://www.w3.org/2000/svg', 'image');
                        flagImage.setAttribute('href', flagDataUrl);
                        flagImage.setAttributeNS('http://www.w3.org/1999/xlink', 'href', flagDataUrl);
                        
                        // For 90-degree rotation, adjust position and swap dimensions
                        // Adjust x,y to keep flag centered after rotation
                        const adjusted_x = phf_x + (phf_width - phf_height) / 2;
                        const adjusted_y = phf_y + (phf_height - phf_width) / 2;
                        
                        flagImage.setAttribute('x', adjusted_x);
                        flagImage.setAttribute('y', adjusted_y);
                        // Swap width and height for 90-degree rotation
                        flagImage.setAttribute('width', phf_height);  // Use height as width
                        flagImage.setAttribute('height', phf_width);  // Use width as height
                        flagImage.setAttribute('preserveAspectRatio', 'none');
                        flagImage.setAttribute('id', 'PHF-filled');
                        
                        // Rotate flag 90 degrees counter-clockwise around the placeholder's center
                        const centerX = phf_x + phf_width / 2;
                        const centerY = phf_y + phf_height / 2;
                        flagImage.setAttribute('transform', `rotate(-90, ${centerX}, ${centerY})`);
                        
                        phf.parentNode.replaceChild(flagImage, phf);
                        console.log('Replaced PHF with flag');
                    }
                } else {
                    console.warn(`Flag SVG file ${flagFilename} not found or failed to load`);
                }
            } else {
                console.warn(`No flag mapping found for country: ${country}`);
            }
        }
        
        // Convert back to string and display
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(svgDoc);
        
        console.log('Step 3: Disc SVG with QR PNG embedded ready for display');
        
        const wrapper = document.createElement('div');
        wrapper.innerHTML = svgString;
        wrapper.style.maxWidth = '100%';
        wrapper.style.overflow = 'auto';
        container.appendChild(wrapper);
        
        // Store reference for download
        wrapper.dataset.svgContent = svgString;
        
        console.log('Disc SVG with embedded PNG QR code created successfully');
        
        return wrapper;
    }

    async downloadIndividual(type) {
        const name = document.getElementById('name').value.trim();
        const fullName = name.replace(/\s+/g, '_');
        const containerId = type === 'badge' ? 'badgePreview' : 'discPreview';
        const container = document.getElementById(containerId);
        
        // Get the wrapper div containing the SVG
        const wrapper = container.querySelector('div[data-svg-content]');
        if (!wrapper || !wrapper.dataset.svgContent) {
            alert('Please generate the QR code first');
            return;
        }

        // Get selected file format
        const fileFormat = document.getElementById('individualFileFormat').value;
        
        if (fileFormat === 'docx') {
            // Convert SVG to DOCX
            await this.convertSvgToDocx(wrapper.dataset.svgContent, `${fullName}_${type}.docx`);
        } else {
            // Convert SVG to PDF
            await this.convertSvgToPdf(wrapper.dataset.svgContent, `${fullName}_${type}.pdf`);
        }
    }

    async loadPhotosFromFolder(event) {
        const files = Array.from(event.target.files);
        this.photoCache.clear();
        
        const imageFiles = files.filter(file => file.type.startsWith('image/'));
        
        if (imageFiles.length === 0) {
            alert('No image files found in the selected folder');
            return;
        }
        
        console.log(`Loading ${imageFiles.length} photos from folder...`);
        
        for (const file of imageFiles) {
            try {
                // Extract ID number from filename (e.g., "123456.jpg" or "ID_123456.jpg")
                const fileName = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
                
                // Try to extract numeric ID from filename
                const idMatch = fileName.match(/\d+/);
                if (idMatch) {
                    const idNumber = idMatch[0];
                    
                    // Resize the image
                    const photoDataUrl = await this.resizeImage(file, 800, 800);
                    
                    // Store with ID number as key
                    this.photoCache.set(idNumber, photoDataUrl);
                    console.log(`Loaded photo: ${file.name} -> ID: "${idNumber}"`);
                } else {
                    console.warn(`Skipping ${file.name} - no ID number found in filename`);
                }
            } catch (error) {
                console.error(`Failed to load photo ${file.name}:`, error);
            }
        }
        
        // Update status display
        document.getElementById('photoCount').textContent = this.photoCache.size;
        document.getElementById('photoFolderStatus').style.display = 'block';
        
        console.log(`Successfully loaded ${this.photoCache.size} photos`);
        console.log('Photo IDs:', Array.from(this.photoCache.keys()));
    }
    
    async getPhotoForPerson(idNumber, photoId = null) {
        // If using Supabase and photoId (member UUID) is provided, fetch from Storage
        if (this.dataSource === 'supabase' && photoId && this.supabaseClient) {
            console.log(`📸 Fetching photo from Supabase Storage...`);
            console.log(`   Bucket: ${this.supabaseBucket || 'member-photos'}`);
            console.log(`   Photo ID (member UUID): ${photoId}`);
            
            try {
                // Fetch photo from Supabase Storage bucket (use configured bucket name)
                // Photos are stored with member UUID as filename
                // Try multiple file extensions since Supabase Storage requires exact filename match
                const bucketName = this.supabaseBucket || 'member-photos';
                const extensionsToTry = ['', '.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP'];
                
                for (const ext of extensionsToTry) {
                    const filename = photoId + ext;
                    console.log(`   🔍 Trying: ${filename}`);
                    
                    const { data, error } = await this.supabaseClient
                        .storage
                        .from(bucketName)
                        .download(filename);
                    
                    if (!error && data) {
                        console.log(`✅ Found photo: ${filename}, size: ${data.size} bytes`);
                        // Convert blob to data URL
                        return new Promise((resolve, reject) => {
                            const reader = new FileReader();
                            reader.onloadend = () => {
                                console.log(`✅ Photo converted to data URL`);
                                resolve(reader.result);
                            };
                            reader.onerror = (err) => {
                                console.error(`❌ Error converting photo to data URL:`, err);
                                reject(err);
                            };
                            reader.readAsDataURL(data);
                        });
                    }
                }
                
                // If we get here, no photo was found with any extension
                console.error(`❌ Photo not found in ${bucketName} with UUID: ${photoId} (tried all common extensions)`);
                return null;
                
            } catch (error) {
                console.error(`❌ Exception fetching photo from Supabase:`, error);
                return null;
            }
        }
        
        // Fallback: Match photo by ID number from local photo cache
        if (!idNumber) {
            console.log('No ID number provided for photo lookup');
            return null;
        }
        
        // Convert to string and remove any non-numeric characters for matching
        const cleanId = idNumber.toString().replace(/\D/g, '');
        
        if (this.photoCache.has(cleanId)) {
            console.log(`Found photo in local cache for ID: ${cleanId}`);
            return this.photoCache.get(cleanId);
        }
        
        // Try to find with original ID format
        if (this.photoCache.has(idNumber.toString())) {
            console.log(`Found photo in local cache for ID: ${idNumber}`);
            return this.photoCache.get(idNumber.toString());
        }
        
        console.log(`No photo found for ID: ${idNumber}`);
        return null;
    }
    
    // Toggle photo folder checkbox visibility based on data source
    updatePhotoFolderVisibility() {
        const photoGroup = document.getElementById('usePhotosCheckbox').closest('.form-group');
        
        if (this.dataSource === 'supabase') {
            // Hide photo folder option when using Supabase (photos auto-fetch from Storage)
            photoGroup.style.display = 'none';
            // Uncheck and hide the section
            document.getElementById('usePhotosCheckbox').checked = false;
            document.getElementById('photoFolderSection').style.display = 'none';
        } else {
            // Show photo folder option for Excel/fallback mode
            photoGroup.style.display = 'block';
        }
    }
    
    // Load Supabase configuration from conf.json file
    async loadSupabaseConfig() {
        try {
            const response = await fetch('conf.json');
            if (!response.ok) {
                console.warn('conf.json not found or not accessible');
                return;
            }
            
            const config = await response.json();
            const supabaseConfig = config.supabase;
            
            if (supabaseConfig && supabaseConfig.url && supabaseConfig.anonKey) {
                this.initializeSupabase(
                    supabaseConfig.url,
                    supabaseConfig.anonKey,
                    supabaseConfig.tableName || 'members',
                    supabaseConfig.bucketName || 'member-photos'
                );
                console.log('✅ Supabase configuration loaded from conf.json');
            } else {
                console.log('ℹ️ Supabase not configured in conf.json - will use local Excel file');
            }
        } catch (error) {
            console.error('❌ Error loading conf.json:', error);
        }
    }
    
    // Initialize Supabase client
    initializeSupabase(url, key, table = 'members', bucket = 'photos') {
        try {
            this.supabaseClient = supabase.createClient(url, key);
            this.supabaseTable = table || 'members';
            this.supabaseBucket = bucket || 'photos';
            console.log('Supabase client initialized');
            console.log('Table:', this.supabaseTable, 'Bucket:', this.supabaseBucket);
        } catch (error) {
            console.error('Error initializing Supabase:', error);
            this.supabaseClient = null;
        }
    }
    
    // Supabase configuration is now loaded from conf.json file
    
    // Fetch data from Supabase with validation
    async fetchFromSupabase() {
        console.log('fetchFromSupabase called');
        console.log('supabaseClient exists?', !!this.supabaseClient);
        console.log('supabaseTable:', this.supabaseTable);
        
        if (!this.supabaseClient) {
            console.log('❌ Supabase client not initialized - will use Excel file');
            return null;
        }
        
        console.log('✅ Attempting to fetch data from Supabase table:', this.supabaseTable);
        
        try {
            // Join with annual_membership_records to get payment and ID card status
            const { data, error } = await this.supabaseClient
                .from(this.supabaseTable)
                .select(`
                    *,
                    annual_membership_records (
                        payment_confirmed,
                        id_card_issued
                    )
                `);
            
            if (error) {
                console.error('❌ Supabase query error:', error);
                throw error;
            }
            
            if (!data || data.length === 0) {
                console.warn('⚠️ No data found in Supabase table');
                return null;
            }
            
            console.log(`✅ Fetched ${data.length} records from Supabase`);
            console.log('First record sample:', data[0]);
            console.log('First record annual_membership_records:', data[0].annual_membership_records);
            
            // Validate and transform data
            const validatedData = this.validateAndTransformData(data, 'supabase');
            
            console.log('Validated data result:', validatedData ? `${validatedData.length} records` : 'null');
            
            return validatedData;
        } catch (error) {
            console.error('Error fetching from Supabase:', error);
            return null;
        }
    }
    
    // Validate and transform data with requirements checking
    validateAndTransformData(rawData, source) {
        console.log(`Validating ${rawData.length} records from ${source}...`);
        console.log('Sample raw record:', rawData[0]);
        
        const validRecords = [];
        const warnings = [];
        const skippedRecords = [];
        
        rawData.forEach((row, index) => {
            // Check if record should be skipped based on Supabase criteria
            if (source === 'supabase') {
                // Check missing_info field in members table
                if (row.missing_info === true) {
                    skippedRecords.push({ 
                        row: index + 1, 
                        name: row.personalInfo?.name || row.name || 'Unknown',
                        reason: 'missing_info = true' 
                    });
                    return; // Skip this record
                }
                
                // Check payment_confirmed and id_card_issued from annual_membership_records
                const membershipRecordArray = row.annual_membership_records;
                const membershipRecord = Array.isArray(membershipRecordArray) ? membershipRecordArray[0] : membershipRecordArray;
                
                // Debug logging for first few records
                if (index < 3) {
                    console.log(`DEBUG Row ${index + 1}:`, {
                        name: row.personalInfo?.name || row.name || 'Unknown',
                        membershipRecordArray: membershipRecordArray,
                        isArray: Array.isArray(membershipRecordArray),
                        arrayLength: Array.isArray(membershipRecordArray) ? membershipRecordArray.length : 'N/A',
                        membershipRecord: membershipRecord,
                        payment_confirmed: membershipRecord?.payment_confirmed,
                        id_card_issued: membershipRecord?.id_card_issued,
                        missing_info: row.missing_info
                    });
                }
                
                if (!membershipRecord || (Array.isArray(membershipRecordArray) && membershipRecordArray.length === 0)) {
                    skippedRecords.push({ 
                        row: index + 1, 
                        name: row.personalInfo?.name || row.name || 'Unknown',
                        reason: 'No annual membership record found' 
                    });
                    return; // Skip this record
                }
                
                if (membershipRecord.payment_confirmed !== true) {
                    skippedRecords.push({ 
                        row: index + 1, 
                        name: row.personalInfo?.name || row.name || 'Unknown',
                        reason: 'payment_confirmed is not true' 
                    });
                    return; // Skip this record
                }
                
                if (membershipRecord.id_card_issued === true) {
                    skippedRecords.push({ 
                        row: index + 1, 
                        name: row.personalInfo?.name || row.name || 'Unknown',
                        reason: 'id_card_issued already true (already issued)' 
                    });
                    return; // Skip this record
                }
            }
            
            const issues = [];
            
            // Extract nested data from Supabase structure
            const personal = row.personalInfo || {};
            const ice = row.iceInfo || {};
            const medical = row.medicalInfo || {};
            const membership = row.membershipInfo || {};
            const vehicle = row.vehicleDetails || {};
            
            // Check if member is a trainee (not permanent) - skip trainees
            const membershipNumber = membership.membershipNumber || row.membershipNumber || '';
            const rank = membership.rank || row.rank || '';
            
            if (membershipNumber.toLowerCase().includes('trainee') || rank.toLowerCase().includes('trainee')) {
                skippedRecords.push({ 
                    row: index + 1, 
                    name: personal.name || row.name || 'Unknown',
                    reason: 'Trainee status (not permanent member)' 
                });
                return; // Skip this record
            }
            
            // Combine name and surname from personalInfo
            const fullName = personal.name && personal.surname 
                ? `${personal.name} ${personal.surname}`.trim() 
                : personal.name || personal.surname || row.name || '';
            
            // Combine ICE name and surname
            const iceFullName = ice.name && ice.surname
                ? `${ice.name} ${ice.surname}`.trim()
                : ice.name || ice.surname || '';
            
            // Transform data - ONLY fields needed for badges and QR codes
            const transformedRow = {
                // Badge QR fields
                idNumber: personal.idNumber || row.idNumber || '',
                name: fullName,
                contactNumber: personal.contactNumber || row.contactNumber || '',
                iceContactName: iceFullName,
                iceContactNumber: ice.contactNumber || row.iceContactNumber || '',
                medicalAidName: medical.medicalAidName || row.medicalAidName || '',
                medicalAidNumber: medical.medicalAidNumber || row.medicalAidNumber || '',
                medicalAidPlan: medical.medicalAidPlan || row.medicalAidPlan || '',
                allergies: medical.allergies || row.allergies || '',
                medicalConditions: medical.medicalConditions || row.medicalConditions || '',
                
                // Badge display fields
                startingDate: membership.startingDate || row.startingDate || '',
                membershipNumber: membership.membershipNumber || row.membershipNumber || '',
                position: membership.position || row.position || '',
                rank: membership.rank || row.rank || '',
                country: personal.country || row.country || '', // For flag mapping
                
                // Photo info from Supabase: use member ID as filename if has_photo is true
                hasPhoto: row.has_photo || false,
                photoId: row.id || null, // Member UUID used as photo filename in Storage
                
                // Disc QR fields (vehicle info)
                vehicleMake: vehicle.make || vehicle.vehicleMake || row.vehicleMake || '',
                vehicleModel: vehicle.model || vehicle.vehicleModel || row.vehicleModel || '',
                vehicleRegistration: vehicle.registrationNumber || row.vehicleRegistration || ''
            };
            
            // Debug logging for first record to see photo info
            if (index === 0 && source === 'supabase') {
                console.log('🔍 DEBUG: First record photo info:');
                console.log('  row.has_photo:', row.has_photo);
                console.log('  row.id (member UUID):', row.id);
                console.log('  Will use as photo filename:', transformedRow.hasPhoto ? transformedRow.photoId : 'N/A (no photo)');
            }
            
            // Check only the essential fields
            if (!transformedRow.idNumber) issues.push('Missing ID Number');
            if (!transformedRow.name) issues.push('Missing Name');
            if (!transformedRow.contactNumber) issues.push('Missing Contact Number');
            if (!transformedRow.iceContactName) issues.push('Missing ICE Name');
            if (!transformedRow.iceContactNumber) issues.push('Missing ICE Number');
            
            // Always add the record - just log warnings
            validRecords.push(transformedRow);
            
            if (issues.length > 0) {
                warnings.push({ row: index + 1, name: transformedRow.name || 'Unknown', issues });
            }
        });
        
        console.log(`✅ Processed ${validRecords.length} records (only necessary fields for badges/QR codes)`);
        
        if (skippedRecords.length > 0) {
            console.warn(`⏭️ Skipped ${skippedRecords.length} records (not ready for generation):`);
            skippedRecords.slice(0, 10).forEach(s => {
                console.warn(`  Row ${s.row} (${s.name}): ${s.reason}`);
            });
            if (skippedRecords.length > 10) {
                console.warn(`  ... and ${skippedRecords.length - 10} more`);
            }
        }
        
        if (warnings.length > 0) {
            console.warn(`⚠️ ${warnings.length} records have missing essential fields:`);
            warnings.slice(0, 5).forEach(w => {
                console.warn(`  Row ${w.row} (${w.name}): ${w.issues.join(', ')}`);
            });
            if (warnings.length > 5) {
                console.warn(`  ... and ${warnings.length - 5} more records with warnings`);
            }
        }
        
        return validRecords.length > 0 ? validRecords : null;
    }
    
    // Helper to convert camelCase to snake_case
    camelToSnake(str) {
        return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    }

    async loadXLSXFromAssets() {
        console.log('=== loadXLSXFromAssets called ===');
        console.log('Current dataSource:', this.dataSource);
        console.log('Supabase configured?', !!this.supabaseClient);
        
        const statusElement = document.getElementById('xlsxLoadStatus');
        const dataSourceElement = document.getElementById('dataSourceType');
        statusElement.textContent = 'Loading data...';
        statusElement.style.color = '#007bff';
        dataSourceElement.textContent = 'Loading...';
        
        // Try Supabase first
        console.log('Step 1: Trying Supabase...');
        try {
            const supabaseData = await this.fetchFromSupabase();
            
            if (supabaseData && supabaseData.length > 0) {
                console.log('✅ Successfully loaded from Supabase');
                this.bulkData = supabaseData;
                this.dataSource = 'supabase';
                statusElement.textContent = `✓ Successfully loaded ${supabaseData.length} records from Supabase`;
                statusElement.style.color = '#28a745';
                dataSourceElement.textContent = 'Supabase API';
                dataSourceElement.style.color = '#28a745';
                console.log('Data source set to: Supabase API');
                this.updatePhotoFolderVisibility();
                return;
            } else {
                console.log('⚠️ Supabase returned no data, falling back to Excel');
            }
        } catch (error) {
            console.warn('❌ Supabase fetch failed, falling back to Excel:', error);
        }
        
        // Fallback to Excel file
        console.log('Step 2: Loading from Excel file...');
        try {
            const response = await fetch('assets/EMS_data.xlsx');
            if (!response.ok) {
                throw new Error(`Failed to load file: ${response.status} ${response.statusText}`);
            }
            
            const arrayBuffer = await response.arrayBuffer();
            const data = new Uint8Array(arrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
            const jsonData = XLSX.utils.sheet_to_json(firstSheet);
            
            // Debug: Log first row to see actual column names
            console.log('Excel column names:', Object.keys(jsonData[0]));
            console.log('First row data:', jsonData[0]);
            console.log('First row Name field specifically:', jsonData[0]['Name']);
            console.log('Does Surname column exist?:', jsonData[0].hasOwnProperty('Surname'), jsonData[0]['Surname']);
            
            // Map Excel column names to expected format
            this.bulkData = jsonData.map(row => {
                // Handle Name field - if both Name and Surname columns exist, combine them
                let fullName = row['Name'] || '';
                if (row['Surname'] && row['Surname'].trim()) {
                    // If Surname column exists and has data, combine with Name
                    fullName = `${fullName} ${row['Surname']}`.trim();
                    console.warn('Found separate Surname column - combining Name and Surname. Please update your Excel file to have full name in Name column only.');
                }
                
                return {
                    idNumber: row['ID Number'] || '',
                    name: fullName,
                    contactNumber: row['Contact Number '] || row['Contact Number'] || '',
                    iceContactName: row['ICEName'] || '',
                    iceContactSurname: row['ICESurname'] || '',
                    iceContactNumber: row['ICEContact Number '] || row['ICEContact Number'] || '',
                    medicalAidName: row['Medical Aid Name'] || '',
                    medicalAidNumber: row['Medical Aid Number'] || '',
                    medicalAidPlan: row['Medical Aid Plan'] || '',
                    allergies: row['Allergies'] || '',
                    medicalConditions: row['Medical Conditions'] || '',
                    startingDate: row['Starting Date'] || '',
                    membershipNumber: row['Membership Number'] || '',
                    position: row['Position'] || '',
                    rank: row['Rank'] || '',
                    vehicleMake: row['Vehicle Make'] || '',
                    vehicleModel: row['Model'] || '',
                    vehicleRegistration: row['Registration Number'] || '',
                    country: row['Country'] || ''
                };
            });
            
            this.dataSource = 'excel';
            statusElement.textContent = `✓ Successfully loaded ${jsonData.length} records from Excel`;
            statusElement.style.color = '#28a745';
            dataSourceElement.textContent = 'EMS_Data.xlsx (Local)';
            dataSourceElement.style.color = '#28a745';
            console.log('Loaded data from Excel:', jsonData);
            this.updatePhotoFolderVisibility();
        } catch (error) {
            console.error('Error loading XLSX from assets:', error);
            this.dataSource = 'none';
            statusElement.textContent = `✗ Error: ${error.message}`;
            statusElement.style.color = '#dc3545';
            dataSourceElement.textContent = 'Load Failed';
            dataSourceElement.style.color = '#dc3545';
            alert('Error loading data. Please check Supabase configuration or ensure EMS_Data.xlsx file exists.');
            this.updatePhotoFolderVisibility();
        }
    }

    async generateBulk() {
        if (!this.bulkData || this.bulkData.length === 0) {
            alert('Please upload an XLSX file first');
            return;
        }
        
        console.log('Starting bulk generation with data:', this.bulkData);
        console.log('First row keys:', Object.keys(this.bulkData[0]));

        const type = document.getElementById('bulkType').value;

        // Show progress
        document.getElementById('bulkProgress').style.display = 'block';
        document.getElementById('bulkPreview').style.display = 'none';
        
        const previewGrid = document.getElementById('bulkPreviewGrid');
        previewGrid.innerHTML = '';
        
        this.qrDataCache = [];

        // Generate badges/discs for each row
        for (let i = 0; i < this.bulkData.length; i++) {
            const row = this.bulkData[i];
            
            // Update progress
            const progress = ((i + 1) / this.bulkData.length) * 100;
            document.getElementById('progressFill').style.width = `${progress}%`;
            document.getElementById('progressText').textContent = `Processing: ${i + 1} / ${this.bulkData.length}`;

            // Prepare data structures similar to individual mode
            const fullName = row.name || '';
            
            console.log(`Row ${i} processing:`, {
                fullName: fullName,
                'row.name': row.name,
                'typeof row.name': typeof row.name,
                'row.name length': row.name ? row.name.length : 0
            });
            
            // Fields 1-10 for badge QR code
            const badgeQrCodeData = {
                idNumber: row.idNumber || '',
                name: row.name || '',
                contactNumber: row.contactNumber || '',
                iceContactName: row.iceContactName || '',
                iceContactSurname: row.iceContactSurname || '',
                iceContactNumber: row.iceContactNumber || '',
                medicalAidName: row.medicalAidName || '',
                medicalAidNumber: row.medicalAidNumber || '',
                medicalAidPlan: row.medicalAidPlan || '',
                allergies: this.hasMedicalInfo(row.allergies) ? 'Yes' : 'No',
                medicalConditions: this.hasMedicalInfo(row.medicalConditions) ? 'Yes' : 'No'
            };
            
            // Fields 11-14 for badge display
            const badgeDisplayInfo = {
                name: row.name || '',
                startingDate: row.startingDate || '',
                membershipNumber: row.membershipNumber || '',
                position: row.position || '',
                rank: row.rank || ''
            };
            
            // Fields 1-14 for disc QR code (personal, emergency, medical + vehicle info)
            const discQrCodeData = {
                idNumber: row.idNumber || '',
                name: row.name || '',
                contactNumber: row.contactNumber || '',
                iceContactName: row.iceContactName || '',
                iceContactSurname: row.iceContactSurname || '',
                iceContactNumber: row.iceContactNumber || '',
                medicalAidName: row.medicalAidName || '',
                medicalAidNumber: row.medicalAidNumber || '',
                medicalAidPlan: row.medicalAidPlan || '',
                allergies: this.hasMedicalInfo(row.allergies) ? 'Yes' : 'No',
                medicalConditions: this.hasMedicalInfo(row.medicalConditions) ? 'Yes' : 'No',
                vehicleMake: row.vehicleMake || '',
                vehicleModel: row.vehicleModel || '',
                vehicleRegistration: row.vehicleRegistration || ''
            };
            
            const vehicleInfo = {
                vehicleMake: row.vehicleMake || '',
                vehicleModel: row.vehicleModel || '',
                vehicleRegistration: row.vehicleRegistration || ''
            };
            
            // Badge QR: Custom format with selective labels
            const badgeQrDataStr = this.buildBadgeQRPayload(badgeQrCodeData);
            console.log('Badge QR text length:', badgeQrDataStr.length, 'chars');
            console.log('Badge QR sample:', badgeQrDataStr.substring(0, 200));
            
            // Disc QR: Custom format with selective labels plus vehicle info
            const discQrDataStr = this.buildDiscQRPayload(discQrCodeData);
            console.log('Disc QR text length:', discQrDataStr.length, 'chars');
            console.log('Disc QR sample:', discQrDataStr.substring(0, 200));

            // Check if photos should be used and get photo for this person
            // If using Supabase, always try to fetch photos (use member ID as filename)
            // If using local/Excel, only use photos if checkbox is checked (use ID number)
            let photoDataUrl = null;
            
            if (this.dataSource === 'supabase' && row.hasPhoto && row.photoId) {
                // Supabase mode: automatically try to fetch photo using member UUID as filename
                console.log(`Attempting to fetch photo from Supabase Storage for ${fullName}`);
                console.log(`  has_photo: ${row.hasPhoto}, member ID: ${row.photoId}`);
                photoDataUrl = await this.getPhotoForPerson(row.idNumber, row.photoId);
                
                if (photoDataUrl) {
                    console.log(`✅ Successfully loaded photo from Supabase Storage for ${fullName}`);
                } else {
                    console.log(`⚠️ Failed to load photo from Supabase Storage for ${fullName} (ID: ${row.photoId})`);
                }
            } else if (this.dataSource !== 'supabase') {
                // Local/Excel mode: only use photos if checkbox is checked
                const usePhotos = document.getElementById('usePhotosCheckbox').checked;
                if (usePhotos) {
                    photoDataUrl = await this.getPhotoForPerson(row.idNumber, null);
                    
                    if (photoDataUrl) {
                        console.log(`✅ Using photo from local cache for ${fullName} (ID: ${row.idNumber})`);
                    } else {
                        console.log(`⚠️ No photo found in local cache for ${fullName} (ID: ${row.idNumber})`);
                    }
                }
            } else if (this.dataSource === 'supabase' && !row.hasPhoto) {
                console.log(`ℹ️ No photo for ${fullName} (has_photo: false)`);
            }
            
            // Get country for this row
            const country = row.country ? row.country.trim() : null;
            if (country) {
                console.log(`Country for ${fullName}: "${country}"`);
                const flagFilename = this.countryFlagMap.get(country);
                if (flagFilename) {
                    console.log(`  -> Flag mapping found: ${flagFilename}`);
                } else {
                    console.log(`  -> No flag mapping found for "${country}"`);
                    console.log(`  -> Available countries:`, Array.from(this.countryFlagMap.keys()));
                }
            } else {
                console.log(`Country for ${fullName}: (empty or not provided)`);
            }

            // Generate based on type
            try {
                // Use plain-text payloads for bulk items (open in memo/text apps)

                if (type === 'badge' || type === 'both') {
                    await this.createBulkBadge(fullName, badgeQrDataStr, null, previewGrid, badgeDisplayInfo, i, photoDataUrl, country);
                }

                if (type === 'disc' || type === 'both') {
                    // Skip disc generation if vehicle make is "none", "N/A", or empty
                    const vehicleMake = (row.vehicleMake || '').toString().trim().toLowerCase();
                        if (vehicleMake && vehicleMake !== 'none' && vehicleMake !== 'n/a') {
                        await this.createBulkDisc(fullName, discQrDataStr, null, previewGrid, vehicleInfo, i, country);
                    } else {
                        console.log(`Skipping disc for ${fullName} - no vehicle (make: "${row.vehicleMake || 'empty'}")`);
                    }
                }
            } catch (error) {
                console.error(`Error generating for ${fullName}:`, error);
                // Continue with next entry even if this one fails
            }

            // Small delay to allow UI update
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        console.log(`Completed generation. Total items in cache: ${this.qrDataCache.length}`);

        // Show preview
        document.getElementById('bulkPreview').style.display = 'block';
        document.getElementById('itemCount').textContent = this.qrDataCache.length;
        
        // Reset progress after a moment
        setTimeout(() => {
            document.getElementById('bulkProgress').style.display = 'none';
        }, 1000);
    }

    async createBulkBadge(name, data, qrSize, container, displayInfo, index, photoDataUrl = null, country = null) {
        console.log(`\n=== Starting Badge Generation for ${name} ===`);
        console.log('Step 1: Generate QR code as PNG');
        
        // Generate badge using the same logic as individual mode
        const tempContainer = document.createElement('div');
        tempContainer.id = `bulk-badge-container-${index}`;
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);
        
        // Step 1-2: Create badge with QR PNG embedded in SVG, including photo and country if available
        await this.createBadge(name, data, qrSize, tempContainer.id, displayInfo, photoDataUrl, country);
        
        console.log('Step 2: QR PNG placed on SVG template');
        console.log(`Badge SVG created for ${name}, checking for SVG content...`);
        console.log('TempContainer children:', tempContainer.children.length);
        
        // Extract the SVG for preview
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bulk-item';
        
        const nameEl = document.createElement('h4');
        nameEl.textContent = name;
        itemDiv.appendChild(nameEl);
        
        const typeEl = document.createElement('div');
        typeEl.className = 'bulk-item-type';
        typeEl.textContent = 'BADGE';
        itemDiv.appendChild(typeEl);
        
        const wrapper = tempContainer.querySelector('div[data-svg-content]');
        console.log('Found wrapper:', !!wrapper);
        if (wrapper) {
            const preview = document.createElement('div');
            preview.innerHTML = wrapper.innerHTML;
            preview.style.maxWidth = '200px';
            preview.style.overflow = 'hidden';
            itemDiv.appendChild(preview);
            
            console.log('Step 3: Converting SVG to PDF');
            
            // Step 3: Convert to PDF before storing
            const pdfBlob = await this.convertSvgToPdfBlob(wrapper.dataset.svgContent);
            
            console.log(`Step 4: PDF created for ${name}, size: ${pdfBlob.size} bytes`);
            
            // Store PDF blob for download
            this.qrDataCache.push({
                name: name,
                type: 'badge',
                svgContent: wrapper.dataset.svgContent,
                pdfBlob: pdfBlob
            });
            
            console.log(`=== Badge Generation Complete for ${name} ===\n`);
        } else {
            console.error('No wrapper with data-svg-content found for:', name);
        }
        
        container.appendChild(itemDiv);
        
        // Clean up temp container
        document.body.removeChild(tempContainer);
    }
    
    async createBulkDisc(name, data, qrSize, container, vehicleInfo, index, country = null) {
        console.log(`\n=== Starting Disc Generation for ${name} ===`);
        console.log('Step 1: Generate QR code as PNG');
        
        // Generate disc using the same logic as individual mode
        const tempContainer = document.createElement('div');
        tempContainer.id = `bulk-disc-container-${index}`;
        tempContainer.style.display = 'none';
        document.body.appendChild(tempContainer);
        
        // Step 1-2: Create disc with QR PNG embedded in SVG, with country if available
        await this.createDisc(name, data, qrSize, tempContainer.id, vehicleInfo, country);
        
        console.log('Step 2: QR PNG placed on SVG template');
        console.log(`Disc SVG created for ${name}`);
        
        // Extract the SVG for preview
        const itemDiv = document.createElement('div');
        itemDiv.className = 'bulk-item';
        
        const nameEl = document.createElement('h4');
        nameEl.textContent = name;
        itemDiv.appendChild(nameEl);
        
        const typeEl = document.createElement('div');
        typeEl.className = 'bulk-item-type';
        typeEl.textContent = 'DISC';
        itemDiv.appendChild(typeEl);
        
        const wrapper = tempContainer.querySelector('div[data-svg-content]');
        if (wrapper) {
            const preview = document.createElement('div');
            preview.innerHTML = wrapper.innerHTML;
            preview.style.maxWidth = '200px';
            preview.style.overflow = 'hidden';
            itemDiv.appendChild(preview);
            
            console.log('Step 3: Converting SVG to PDF');
            
            // Step 3: Convert to PDF before storing
            const pdfBlob = await this.convertSvgToPdfBlob(wrapper.dataset.svgContent);
            
            console.log(`Step 4: PDF created for ${name}, size: ${pdfBlob.size} bytes`);
            
            // Store PDF blob for download
            this.qrDataCache.push({
                name: name,
                type: 'disc',
                svgContent: wrapper.dataset.svgContent,
                pdfBlob: pdfBlob
            });
            
            console.log(`=== Disc Generation Complete for ${name} ===\n`);
        }
        
        container.appendChild(itemDiv);
        
        // Clean up temp container
        document.body.removeChild(tempContainer);
    }

    async downloadAll() {
        if (this.qrDataCache.length === 0) {
            alert('No badges/discs to download');
            return;
        }

        try {
            // Show loading indicator
            const downloadBtn = document.getElementById('downloadAllBtn');
            const originalText = downloadBtn.textContent;
            downloadBtn.disabled = true;
            downloadBtn.innerHTML = '⏳ Creating ZIP file...';
            downloadBtn.style.cursor = 'wait';
            
            // Get selected file format
            const fileFormatElement = document.getElementById('bulkFileFormat');
            const fileFormat = fileFormatElement ? fileFormatElement.value : 'pdf';

            console.log(`Preparing to download all as ${fileFormat.toUpperCase()}...`);
            const zip = new JSZip();

            // Add each badge/disc to the zip
            let count = 0;
            for (const item of this.qrDataCache) {
                count++;
                downloadBtn.innerHTML = `⏳ Adding file ${count} of ${this.qrDataCache.length}...`;
                
                const fileExtension = fileFormat === 'docx' ? 'docx' : 'pdf';
                const fileName = `${item.name.replace(/\s+/g, '_')}_${item.type}.${fileExtension}`;
                
                let fileBlob;
                if (fileFormat === 'docx') {
                    // Convert to DOCX
                    fileBlob = await this.convertSvgToDocxBlob(item.svgContent);
                } else {
                    // Use pre-converted PDF blob if available, otherwise convert now
                    fileBlob = item.pdfBlob || await this.convertSvgToPdfBlob(item.svgContent);
                }
                
                console.log(`Adding ${fileName} to zip, size: ${fileBlob.size} bytes`);
                zip.file(fileName, fileBlob);
            }

            downloadBtn.innerHTML = '⏳ Generating ZIP file...';
            console.log('Generating zip file...');
            // Generate and download zip
            const content = await zip.generateAsync({ type: 'blob' });
            console.log(`Zip file generated, size: ${content.size} bytes`);
            const zipName = fileFormat === 'docx' ? 'badges_and_discs_docx.zip' : 'badges_and_discs.zip';
            saveAs(content, zipName);
            
            // Reset button
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = originalText;
            downloadBtn.style.cursor = 'pointer';
        } catch (error) {
            console.error('Error during download:', error);
            alert('Error creating download file: ' + error.message);
            
            // Reset button on error
            const downloadBtn = document.getElementById('downloadAllBtn');
            downloadBtn.disabled = false;
            downloadBtn.innerHTML = 'Download All as ZIP';
            downloadBtn.style.cursor = 'pointer';
        }
    }
    
    async convertSvgToPdf(svgContent, filename) {
        const pdfBlob = await this.convertSvgToPdfBlob(svgContent);
        saveAs(pdfBlob, filename);
    }
    
    async convertSvgToDocx(svgContent, filename) {
        const docxBlob = await this.convertSvgToDocxBlob(svgContent);
        saveAs(docxBlob, filename);
    }
    
    async convertSvgToDocxBlob(svgContent) {
        return new Promise(async (resolve, reject) => {
            try {
                // Parse SVG to get dimensions
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;
                
                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');
                const viewBox = svgElement.getAttribute('viewBox');
                
                let canvasWidth, canvasHeight;
                let pageWidthMm, pageHeightMm;
                
                // Get dimensions from viewBox
                if (viewBox) {
                    const parts = viewBox.split(/\s+/);
                    canvasWidth = parseFloat(parts[2]);
                    canvasHeight = parseFloat(parts[3]);
                } else {
                    canvasWidth = 595;
                    canvasHeight = 842;
                }
                
                // Get page dimensions in mm from SVG attributes
                if (widthAttr && widthAttr.includes('mm')) {
                    pageWidthMm = parseFloat(widthAttr);
                } else if (widthAttr) {
                    pageWidthMm = (parseFloat(widthAttr) / 96) * 25.4;
                } else {
                    pageWidthMm = (canvasWidth / 96) * 25.4;
                }
                
                if (heightAttr && heightAttr.includes('mm')) {
                    pageHeightMm = parseFloat(heightAttr);
                } else if (heightAttr) {
                    pageHeightMm = (parseFloat(heightAttr) / 96) * 25.4;
                } else {
                    pageHeightMm = (canvasHeight / 96) * 25.4;
                }
                
                // Determine scale and orientation based on document type
                const scale = pageWidthMm > 250 ? 10 : 3;
                const isLandscape = pageWidthMm > pageHeightMm;
                
                // Create canvas to convert SVG to image
                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth * scale;
                canvas.height = canvasHeight * scale;
                const ctx = canvas.getContext('2d');
                
                // Draw white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Create an image from SVG
                const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                img.onload = async () => {
                    try {
                        // Draw SVG image
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        
                        // Overlay QR code images
                        const imageElements = svgDoc.querySelectorAll('image[id*="QR"], image[id*="PHQR"]');
                        for (const imgEl of imageElements) {
                            const href = imgEl.getAttribute('href') || imgEl.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                            if (href && href.startsWith('data:image')) {
                                const qrImage = new Image();
                                await new Promise((resolveImg) => {
                                    qrImage.onload = resolveImg;
                                    qrImage.src = href;
                                });
                                
                                const x = parseFloat(imgEl.getAttribute('x')) * scale;
                                const y = parseFloat(imgEl.getAttribute('y')) * scale;
                                const w = parseFloat(imgEl.getAttribute('width')) * scale;
                                const h = parseFloat(imgEl.getAttribute('height')) * scale;
                                
                                ctx.drawImage(qrImage, x, y, w, h);
                            }
                        }
                        
                        // Convert canvas to blob
                        canvas.toBlob(async (blob) => {
                            if (!blob) {
                                URL.revokeObjectURL(url);
                                reject(new Error('Failed to create image blob from canvas'));
                                return;
                            }
                            
                            try {
                                // Create DOCX file using JSZip
                                const zip = new JSZip();
                                
                                // Convert image blob to base64
                                const reader = new FileReader();
                                reader.onloadend = async () => {
                                    const base64data = reader.result.split(',')[1];
                                    
                                    // Calculate dimensions in EMUs (914400 EMUs per inch) from mm, not canvas pixels
                                    const widthEMU = Math.round((pageWidthMm / 25.4) * 914400);
                                    const heightEMU = Math.round((pageHeightMm / 25.4) * 914400);
                                    
                                    // Calculate page dimensions in twips (1440 twips per inch, or 56.692913386 twips per mm)
                                    const pageWidthTwips = Math.round(pageWidthMm * 56.692913386);
                                    const pageHeightTwips = Math.round(pageHeightMm * 56.692913386);
                                    
                                    // Page orientation
                                    const orientation = isLandscape ? 'landscape' : 'portrait';
                                    
                                    // Create DOCX structure
                                    zip.file('[Content_Types].xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="png" ContentType="image/png"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
                                    
                                    zip.file('_rels/.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
                                    
                                    zip.file('word/_rels/document.xml.rels', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>`);
                                    
                                    zip.file('word/document.xml', `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:body>
<w:p>
<w:pPr>
<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>
<w:ind w:left="0" w:right="0" w:firstLine="0"/>
<w:jc w:val="left"/>
</w:pPr>
<w:r>
<w:rPr/>
<w:drawing>
<wp:inline distT="0" distB="0" distL="0" distR="0">
<wp:extent cx="${widthEMU}" cy="${heightEMU}"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:docPr id="1" name="Picture"/>
<wp:cNvGraphicFramePr/>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:nvPicPr>
<pic:cNvPr id="1" name="Picture"/>
<pic:cNvPicPr/>
</pic:nvPicPr>
<pic:blipFill>
<a:blip r:embed="rId1"/>
<a:stretch><a:fillRect/></a:stretch>
</pic:blipFill>
<pic:spPr>
<a:xfrm>
<a:off x="0" y="0"/>
<a:ext cx="${widthEMU}" cy="${heightEMU}"/>
</a:xfrm>
<a:prstGeom prst="rect"><a:avLst/></a:prstGeom>
</pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:inline>
</w:drawing>
</w:r>
</w:p>
<w:sectPr>
<w:pgSz w:w="${pageWidthTwips}" w:h="${pageHeightTwips}" w:orient="${orientation}"/>
<w:pgMar w:top="0" w:right="0" w:bottom="0" w:left="0" w:header="0" w:footer="0" w:gutter="0"/>
</w:sectPr>
</w:body>
</w:document>`);
                                    
                                    // Add the image
                                    zip.file('word/media/image1.png', base64data, {base64: true});
                                    
                                    // Generate DOCX
                                    const docxBlob = await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
                                    
                                    URL.revokeObjectURL(url);
                                    resolve(docxBlob);
                                };
                                reader.readAsDataURL(blob);
                                
                            } catch (error) {
                                console.error('DOCX generation error:', error);
                                URL.revokeObjectURL(url);
                                reject(error);
                            }
                        }, 'image/png');
                        
                    } catch (error) {
                        console.error('Canvas conversion error:', error);
                        URL.revokeObjectURL(url);
                        reject(error);
                    }
                };
                
                img.onerror = (error) => {
                    console.error('Image load error:', error);
                    URL.revokeObjectURL(url);
                    reject(error);
                };
                
                img.src = url;
                
            } catch (error) {
                console.error('DOCX conversion error:', error);
                reject(error);
            }
        });
    }
    
    async convertSvgToPdfBlob(svgContent) {
        return new Promise(async (resolve, reject) => {
            try {
                // Parse SVG to get dimensions and QR code images
                const parser = new DOMParser();
                const svgDoc = parser.parseFromString(svgContent, 'image/svg+xml');
                const svgElement = svgDoc.documentElement;
                
                // Get dimensions - use viewBox for canvas (coordinates), width/height for PDF (physical)
                const widthAttr = svgElement.getAttribute('width');
                const heightAttr = svgElement.getAttribute('height');
                const viewBox = svgElement.getAttribute('viewBox');
                
                let canvasWidth, canvasHeight;  // For rendering (viewBox coordinates)
                let pdfWidthMm, pdfHeightMm;    // For PDF output (physical dimensions)
                
                // Canvas dimensions from viewBox (coordinate system for QR placement)
                let viewBoxMinX = 0, viewBoxMinY = 0;
                if (viewBox) {
                    const parts = viewBox.split(/\s+/);
                    viewBoxMinX = parseFloat(parts[0]);
                    viewBoxMinY = parseFloat(parts[1]);
                    canvasWidth = parseFloat(parts[2]);
                    canvasHeight = parseFloat(parts[3]);
                } else {
                    canvasWidth = 595;
                    canvasHeight = 842;
                }
                
                console.log(`ViewBox: ${viewBoxMinX} ${viewBoxMinY} ${canvasWidth} ${canvasHeight}`);
                
                // PDF dimensions from width/height attributes
                if (widthAttr && widthAttr.includes('mm')) {
                    pdfWidthMm = parseFloat(widthAttr);
                } else if (widthAttr) {
                    pdfWidthMm = (parseFloat(widthAttr) / 96) * 25.4;
                } else {
                    pdfWidthMm = (canvasWidth / 96) * 25.4;
                }
                
                if (heightAttr && heightAttr.includes('mm')) {
                    pdfHeightMm = parseFloat(heightAttr);
                } else if (heightAttr) {
                    pdfHeightMm = (parseFloat(heightAttr) / 96) * 25.4;
                } else {
                    pdfHeightMm = (canvasHeight / 96) * 25.4;
                }
                
                // Extract QR code images from SVG
                const qrImages = [];
                const imageElements = svgDoc.querySelectorAll('image[id*="QR"], image[id*="PHQR"]');
                imageElements.forEach(img => {
                    const href = img.getAttribute('href') || img.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
                    if (href && href.startsWith('data:image')) {
                        qrImages.push({
                            dataUrl: href,
                            x: parseFloat(img.getAttribute('x')),
                            y: parseFloat(img.getAttribute('y')),
                            width: parseFloat(img.getAttribute('width')),
                            height: parseFloat(img.getAttribute('height'))
                        });
                    }
                });
                
                console.log('Found', qrImages.length, 'QR code images to overlay');
                
                // Determine scale based on document type (using PDF dimensions)
                // Discs are 297mm wide (landscape), badges are smaller
                const scale = pdfWidthMm > 250 ? 10 : 3; // 10x for discs, 3x for badges
                
                console.log(`Using scale: ${scale}x for ${pdfWidthMm}mm x ${pdfHeightMm}mm document`);
                
                // Create canvas - use viewBox dimensions directly
                const canvas = document.createElement('canvas');
                canvas.width = canvasWidth * scale;
                canvas.height = canvasHeight * scale;
                const ctx = canvas.getContext('2d');
                
                // Draw white background
                ctx.fillStyle = 'white';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                
                // Create an image from SVG 
                const svgBlob = new Blob([svgContent], { type: 'image/svg+xml;charset=utf-8' });
                const url = URL.createObjectURL(svgBlob);
                
                const img = new Image();
                img.onload = async () => {
                    try {
                        console.log('SVG image loaded, drawing to canvas...');
                        
                        // Draw SVG image - no offset needed since viewBox was adjusted
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        console.log('SVG drawn to canvas');
                        
                        // Now overlay QR code images on top
                        let qrCount = 0;
                        for (const qrImg of qrImages) {
                            console.log('Loading QR image', qrCount + 1, 'at position:', qrImg.x, qrImg.y);
                            
                            const qrImage = new Image();
                            await new Promise((resolveImg, rejectImg) => {
                                qrImage.onload = () => {
                                    console.log('QR image loaded successfully:', qrImage.width, 'x', qrImage.height);
                                    resolveImg();
                                };
                                qrImage.onerror = (e) => {
                                    console.error('QR image load FAILED:', e);
                                    rejectImg(new Error('QR image load failed'));
                                };
                                qrImage.src = qrImg.dataUrl;
                            });
                            
                            // Draw QR code at correct position with scale
                            const drawX = qrImg.x * scale;
                            const drawY = qrImg.y * scale;
                            const drawW = qrImg.width * scale;
                            const drawH = qrImg.height * scale;
                            
                            console.log('Drawing QR at canvas coords:', drawX, drawY, drawW, drawH);
                            ctx.drawImage(qrImage, drawX, drawY, drawW, drawH);
                            
                            // Verify it was drawn by checking canvas
                            const pixelData = ctx.getImageData(drawX + drawW/2, drawY + drawH/2, 1, 1).data;
                            console.log('Pixel check at QR center:', pixelData[0], pixelData[1], pixelData[2], pixelData[3]);
                            
                            qrCount++;
                        }
                        
                        // Convert canvas to data URL with maximum quality
                        const imgData = canvas.toDataURL('image/jpeg', 1.0);
                        
                        console.log(`Canvas size: ${canvas.width} x ${canvas.height}px (scale: ${scale}x)`);
                        console.log(`PDF size: ${pdfWidthMm}mm x ${pdfHeightMm}mm`);
                        
                        const { jsPDF } = window.jspdf;
                        const pdf = new jsPDF({
                            orientation: pdfWidthMm > pdfHeightMm ? 'landscape' : 'portrait',
                            unit: 'mm',
                            format: [pdfWidthMm, pdfHeightMm]
                        });
                        
                        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidthMm, pdfHeightMm);
                        const pdfBlob = pdf.output('blob');
                        
                        URL.revokeObjectURL(url);
                        resolve(pdfBlob);
                    } catch (error) {
                        console.error('Canvas conversion error:', error);
                        URL.revokeObjectURL(url);
                        reject(error);
                    }
                };
                
                img.onerror = (error) => {
                    console.error('Image load error:', error);
                    URL.revokeObjectURL(url);
                    reject(error);
                };
                
                img.src = url;
                
            } catch (error) {
                console.error('PDF conversion error:', error);
                reject(error);
            }
        });
    }
}

// Initialize the application when DOM is loaded
let app; // Global reference for settings modal onclick handlers
document.addEventListener('DOMContentLoaded', () => {
    app = new QRGenerator();
});
