class BlockchairAPI {
    constructor() {
        this.API_KEY = 'A___XlvcUCcOjwiFTR2rRKASglriL77n';
        this.BASE_URL = 'https://api.blockchair.com/bitcoin';
        this.requestsLeft = 10000;
        this.requestsPerSecond = 0;
        this.lastRequestTime = Date.now();
    }

    async checkAddress(address) {
        if (this.requestsLeft <= 0) {
            throw new Error('API limit reached');
        }

        // Ensure we don't exceed rate limits
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < 100) { // Minimum 100ms between requests
            await new Promise(resolve => setTimeout(resolve, 100 - timeSinceLastRequest));
        }

        try {
            // Construct URL with proper format
            const url = `${this.BASE_URL}/dashboards/address/${address}`;
            const separator = url.includes('?') ? '&' : '?';
            const finalUrl = `${url}${separator}key=${this.API_KEY}`;

            console.log('Requesting URL:', finalUrl);

            const response = await fetch(finalUrl);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Response:', errorText);
                throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
            }

            const data = await response.json();
            this.requestsLeft--;
            this.lastRequestTime = Date.now();
            
            // Update requests per second
            this.requestsPerSecond = 1000 / (this.lastRequestTime - now);

            // Check if data has the expected structure
            if (!data.data || !data.data[address]) {
                console.error('Unexpected API response structure:', data);
                throw new Error('Invalid API response structure');
            }

            return {
                balance: data.data[address].balance || 0,
                totalTransactions: data.data[address].transaction_count || 0,
                firstSeen: data.data[address].first_seen_in || null,
                lastSeen: data.data[address].last_seen_in || null
            };
        } catch (error) {
            console.error('Error checking address:', error);
            throw error;
        }
    }

    getRequestsLeft() {
        return this.requestsLeft;
    }

    getRequestsPerSecond() {
        return this.requestsPerSecond;
    }
} 