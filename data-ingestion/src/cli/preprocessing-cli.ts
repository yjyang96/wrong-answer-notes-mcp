#!/usr/bin/env node

import * as dotenv from 'dotenv';
dotenv.config();

import { Command } from 'commander';
import { PreprocessingService } from '../services/preprocessing';
import { CommitData } from '../models/commit';
import { Logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

const program = new Command();
const logger = new Logger('PreprocessingCLI');

program
  .name('preprocessing-cli')
  .description('CLI for commit data preprocessing and labeling')
  .version('1.0.0');

program
  .command('preprocess')
  .description('Preprocess commit data from JSON file')
  .requiredOption('-i, --input <file>', 'Input JSON file with commit data')
  .option('-o, --output <file>', 'Output JSON file for processed data', './output/processed_commits.json')
  .option('--test', 'Test preprocessing pipeline before running')
  .action(async (options) => {
    try {
      const preprocessingService = new PreprocessingService();

      // Test pipeline if requested
      if (options.test) {
        logger.info('Testing preprocessing pipeline...');
        const testResult = await preprocessingService.testPipeline();
        if (!testResult) {
          logger.error('Pipeline test failed. Exiting.');
          process.exit(1);
        }
        logger.info('Pipeline test passed.');
      }

      // Load input data
      console.log('📁 Loading commit data...');
      logger.info(`Loading commit data from ${options.input}`);
      const inputData = await fs.readFile(options.input, 'utf-8');
      const commits: CommitData[] = JSON.parse(inputData);

      if (!Array.isArray(commits) || commits.length === 0) {
        throw new Error('Input file must contain an array of commit data');
      }

      console.log(`✅ Loaded ${commits.length} commits for preprocessing`);
      logger.info(`Loaded ${commits.length} commits for preprocessing`);

      // Preprocess commits
      console.log('🔄 Starting preprocessing pipeline...');
      const processedCommits = await preprocessingService.preprocessCommits(commits);
      console.log(`✅ Preprocessing completed: ${processedCommits.length} commits processed`);

      // Save processed data
      console.log('💾 Saving processed data...');
      await preprocessingService.saveProcessedCommits(processedCommits, options.output);
      console.log(`✅ Data saved to ${options.output}`);

      // Generate and display report
      const report = preprocessingService.generateReport(processedCommits);
      
      console.log('\n=== PREPROCESSING REPORT ===');
      console.log(`Total commits processed: ${report.summary.total_commits}`);
      console.log(`Valid commits: ${report.qualityDistribution.valid}`);
      console.log(`Warning commits: ${report.qualityDistribution.warning}`);
      console.log(`Invalid commits: ${report.qualityDistribution.invalid}`);
      console.log(`Average confidence: ${report.summary.average_confidence.toFixed(3)}`);
      console.log(`Overall quality score: ${report.summary.quality_score.toFixed(3)}`);
      
      console.log('\n=== CATEGORY BREAKDOWN ===');
      Object.entries(report.categoryBreakdown).forEach(([category, count]) => {
        console.log(`${category}: ${count} (${((count / report.summary.total_commits) * 100).toFixed(1)}%)`);
      });

      console.log('\n=== CONFIDENCE DISTRIBUTION ===');
      Object.entries(report.confidenceDistribution).forEach(([range, count]) => {
        console.log(`${range}: ${count} (${((count / report.summary.total_commits) * 100).toFixed(1)}%)`);
      });

      if (report.recommendations.length > 0) {
        console.log('\n=== RECOMMENDATIONS ===');
        report.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }

      if (!report.consistency.isConsistent) {
        console.log('\n=== CONSISTENCY ISSUES ===');
        report.consistency.issues.forEach((issue, index) => {
          console.log(`${index + 1}. ${issue}`);
        });
      }

      logger.info('Preprocessing completed successfully');
    } catch (error) {
      logger.error(`Preprocessing failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('Validate processed commit data')
  .requiredOption('-i, --input <file>', 'Input JSON file with processed commit data')
  .action(async (options) => {
    try {
      const preprocessingService = new PreprocessingService();
      
      // Load processed data
      logger.info(`Loading processed commit data from ${options.input}`);
      const processedCommits = await preprocessingService.loadProcessedCommits(options.input);

      // Generate validation report
      const report = preprocessingService.generateReport(processedCommits);
      
      console.log('\n=== VALIDATION REPORT ===');
      console.log(`Total commits: ${report.summary.total_commits}`);
      console.log(`Valid: ${report.qualityDistribution.valid}`);
      console.log(`Warnings: ${report.qualityDistribution.warning}`);
      console.log(`Invalid: ${report.qualityDistribution.invalid}`);
      console.log(`Quality score: ${report.summary.quality_score.toFixed(3)}`);
      console.log(`Average confidence: ${report.summary.average_confidence.toFixed(3)}`);

      if (!report.consistency.isConsistent) {
        console.log('\n=== CONSISTENCY ISSUES ===');
        report.consistency.issues.forEach((issue, index) => {
          console.log(`${index + 1}. ${issue}`);
        });
      }

      if (report.recommendations.length > 0) {
        console.log('\n=== RECOMMENDATIONS ===');
        report.recommendations.forEach((rec, index) => {
          console.log(`${index + 1}. ${rec}`);
        });
      }

      logger.info('Validation completed');
    } catch (error) {
      logger.error(`Validation failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('test')
  .description('Test preprocessing pipeline components')
  .action(async () => {
    try {
      const preprocessingService = new PreprocessingService();
      
      logger.info('Testing preprocessing pipeline...');
      const testResult = await preprocessingService.testPipeline();
      
      if (testResult) {
        console.log('✅ All pipeline tests passed');
        logger.info('Pipeline test completed successfully');
      } else {
        console.log('❌ Pipeline tests failed');
        logger.error('Pipeline test failed');
        process.exit(1);
      }
    } catch (error) {
      logger.error(`Pipeline test failed: ${error}`);
      process.exit(1);
    }
  });

program
  .command('stats')
  .description('Show statistics for commit data')
  .requiredOption('-i, --input <file>', 'Input JSON file with commit data')
  .action(async (options) => {
    try {
      // Load data
      const inputData = await fs.readFile(options.input, 'utf-8');
      const commits: CommitData[] = JSON.parse(inputData);

      if (!Array.isArray(commits)) {
        throw new Error('Input file must contain an array of commit data');
      }

      // Calculate basic statistics
      const totalCommits = commits.length;
      const uniqueAuthors = new Set(commits.map(c => c.author.name)).size;
      const uniqueRepositories = new Set(commits.map(c => c.repository.fullName)).size;
      
      const messageLengths = commits.map(c => c.message.length);
      const avgMessageLength = messageLengths.reduce((a, b) => a + b, 0) / messageLengths.length;
      
      const diffSizes = commits.map(c => c.diff.length);
      const avgDiffSize = diffSizes.reduce((a, b) => a + b, 0) / diffSizes.length;

      const fileTypes: { [key: string]: number } = {};
      commits.forEach(commit => {
        commit.files.forEach(file => {
          const ext = path.extname(file.path) || 'no_extension';
          fileTypes[ext] = (fileTypes[ext] || 0) + 1;
        });
      });

      console.log('\n=== COMMIT DATA STATISTICS ===');
      console.log(`Total commits: ${totalCommits}`);
      console.log(`Unique authors: ${uniqueAuthors}`);
      console.log(`Unique repositories: ${uniqueRepositories}`);
      console.log(`Average message length: ${avgMessageLength.toFixed(1)} characters`);
      console.log(`Average diff size: ${avgDiffSize.toFixed(1)} characters`);
      
      console.log('\n=== FILE TYPE DISTRIBUTION ===');
      const sortedFileTypes = Object.entries(fileTypes)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10);
      
      sortedFileTypes.forEach(([ext, count]) => {
        console.log(`${ext}: ${count} (${((count / totalCommits) * 100).toFixed(1)}%)`);
      });

      logger.info('Statistics generated successfully');
    } catch (error) {
      logger.error(`Failed to generate statistics: ${error}`);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();
