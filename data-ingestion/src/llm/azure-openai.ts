import { Logger } from '../utils/logger';
import { LLMClassificationRequest, LLMClassificationResponse } from '../models/processed-commit';

export class AzureOpenAIService {
  private logger: Logger;
  private apiKey: string;
  private endpoint: string;
  private deployment: string;
  private apiVersion: string;

  constructor() {
    this.logger = new Logger('AzureOpenAIService');
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

    if (!this.apiKey) {
      this.logger.warn('Azure OpenAI API key not found in environment variables');
    }
  }

  /**
   * Classify commit using Azure OpenAI GPT-4o
   */
  public async classifyCommit(request: LLMClassificationRequest): Promise<LLMClassificationResponse> {
    if (!this.apiKey) {
      throw new Error('Azure OpenAI API key is not configured');
    }

    const prompt = this.buildClassificationPrompt(request);
    
    try {
      const response = await this.callOpenAIAPI(prompt);
      return this.parseClassificationResponse(response);
    } catch (error) {
      this.logger.error(`Failed to classify commit: ${error}`);
      throw error;
    }
  }

  /**
   * Build classification prompt for the commit
   */
  private buildClassificationPrompt(request: LLMClassificationRequest): string {
    return `You are an expert software engineer analyzing Git commits for a wrong answer notes database that focuses on version updates, bug fixes, and error-related changes.

Please analyze the following commit and classify it into one of these categories with BROADER definitions:

- version_update: ANY version-related changes including:
  * Package/dependency version updates (update, upgrade, bump, version)
  * API version changes, protocol version updates
  * Library updates, framework updates
  * Compatibility changes, forward compatibility updates
  * GraphDef version updates, schema version changes

- fix: ANY bug fixes, corrections, or issue resolutions including:
  * Explicit bug fixes (fix, bug, issue, problem)
  * Build fixes, compilation fixes, test fixes
  * Performance fixes, memory fixes, optimization fixes
  * API fixes, interface fixes, signature fixes
  * Configuration fixes, setup fixes

- patch: Critical patches, security fixes, or hotfixes including:
  * Security patches, vulnerability fixes
  * Critical bug fixes, urgent fixes
  * Hotfixes, emergency patches
  * Critical performance patches

- error: Error handling, exception fixes, or failure corrections including:
  * Exception handling improvements
  * Error message improvements
  * Failure recovery mechanisms
  * Error logging, debugging improvements
  * Test failure fixes, CI/CD fixes

- other: ONLY general code changes that are NOT related to versions, fixes, patches, or errors:
  * Pure refactoring without bug fixes
  * Documentation-only changes
  * Code style changes
  * New feature additions (not fixes)
  * Internal restructuring without functional changes

Commit Message: ${request.commit_message}

File Changes: ${request.file_changes.join(', ')}

Diff Summary: ${request.diff_summary}

IMPORTANT: Be more inclusive for version_update, fix, patch, and error categories. Only use "other" for truly general changes that don't address specific issues or versions.

Please respond with a JSON object containing:
{
  "type": "one of the categories above",
  "confidence": "number between 0.0 and 1.0",
  "package_name": "extracted package name if applicable",
  "version": "version information if applicable",
  "error_type": "type of error if applicable",
  "api_signature": "API signature if applicable",
  "reasoning": "brief explanation of your classification"
}

Focus on identifying:
1. Package names from file paths or commit messages
2. Version numbers or version-related changes
3. Error types and API signatures from the diff
4. The primary purpose of this commit

Respond only with valid JSON.`;
  }

  /**
   * Call Azure OpenAI API
   */
  private async callOpenAIAPI(prompt: string): Promise<string> {
    const url = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
    
    const requestBody = {
      messages: [
        {
          role: 'system',
          content: 'You are an expert software engineer specializing in Git commit analysis and classification.'
        },
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: 1000,
      temperature: 0.1,
      top_p: 0.9
    };

    this.logger.debug(`Calling Azure OpenAI API: ${url}`);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.apiKey
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Azure OpenAI API error: ${response.status} ${errorText}`);
    }

    const data: any = await response.json();
    
    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from Azure OpenAI API');
    }

    return data.choices[0].message.content;
  }

  /**
   * Parse classification response from LLM
   */
  private parseClassificationResponse(response: string): LLMClassificationResponse {
    try {
      // Clean the response to extract JSON
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);
      
      // Validate required fields
      if (!parsed.type || !parsed.confidence || !parsed.reasoning) {
        throw new Error('Missing required fields in classification response');
      }

      // Validate type
      const validTypes = ['version_update', 'fix', 'patch', 'error', 'other'];
      if (!validTypes.includes(parsed.type)) {
        parsed.type = 'other';
      }

      // Validate confidence
      parsed.confidence = Math.max(0, Math.min(1, parseFloat(parsed.confidence) || 0));

      return {
        type: parsed.type,
        confidence: parsed.confidence,
        package_name: parsed.package_name || undefined,
        version: parsed.version || undefined,
        error_type: parsed.error_type || undefined,
        api_signature: parsed.api_signature || undefined,
        reasoning: parsed.reasoning
      };
    } catch (error) {
      this.logger.error(`Failed to parse classification response: ${error}`);
      this.logger.debug(`Raw response: ${response}`);
      
      // Return default classification on parse error
      return {
        type: 'other',
        confidence: 0.1,
        reasoning: `Parse error: ${error}`
      };
    }
  }

  /**
   * Batch classify multiple commits
   */
  public async batchClassifyCommits(requests: LLMClassificationRequest[]): Promise<LLMClassificationResponse[]> {
    this.logger.info(`Starting batch classification for ${requests.length} commits`);
    
    const results: LLMClassificationResponse[] = [];
    const batchSize = 5; // Process in small batches to avoid rate limits
    
    for (let i = 0; i < requests.length; i += batchSize) {
      const batch = requests.slice(i, i + batchSize);
      this.logger.debug(`Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(requests.length / batchSize)}`);
      
      const batchPromises = batch.map(request => this.classifyCommit(request));
      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < requests.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    this.logger.info(`Completed batch classification for ${results.length} commits`);
    return results;
  }

  /**
   * Test API connectivity
   */
  public async testConnection(): Promise<boolean> {
    try {
      const testRequest: LLMClassificationRequest = {
        commit_message: 'test commit',
        diff_summary: 'test diff',
        file_changes: ['test.py']
      };
      
      await this.classifyCommit(testRequest);
      this.logger.info('Azure OpenAI API connection test successful');
      return true;
    } catch (error) {
      this.logger.error(`Azure OpenAI API connection test failed: ${error}`);
      return false;
    }
  }
}
