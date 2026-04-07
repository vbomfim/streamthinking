/**
 * Unit tests for AWS Pro hand-crafted stencil SVGs.
 *
 * Covers: 30 AWS service icons across Compute, Storage, Database,
 * Networking, Security, Management, and Messaging sub-categories.
 * Verifies catalog registration, category count, SVG validity,
 * default sizes, and naming conventions.
 *
 * @module
 */

import { describe, it, expect } from 'vitest';
import {
  STENCIL_CATALOG,
  getStencil,
  getStencilsByCategory,
  getAllCategories,
} from '../renderer/stencils/index.js';

// ── AWS Pro stencil definitions ──────────────────────────

const AWS_PRO_STENCILS: Array<{ id: string; label: string }> = [
  // Compute
  { id: 'aws-pro-ec2', label: 'EC2' },
  { id: 'aws-pro-lambda', label: 'Lambda' },
  { id: 'aws-pro-ecs', label: 'ECS' },
  { id: 'aws-pro-eks', label: 'EKS' },
  { id: 'aws-pro-fargate', label: 'Fargate' },
  { id: 'aws-pro-lightsail', label: 'Lightsail' },
  // Storage
  { id: 'aws-pro-s3', label: 'S3' },
  { id: 'aws-pro-ebs', label: 'EBS' },
  { id: 'aws-pro-efs', label: 'EFS' },
  { id: 'aws-pro-glacier', label: 'Glacier' },
  // Database
  { id: 'aws-pro-rds', label: 'RDS' },
  { id: 'aws-pro-dynamodb', label: 'DynamoDB' },
  { id: 'aws-pro-aurora', label: 'Aurora' },
  { id: 'aws-pro-elasticache', label: 'ElastiCache' },
  { id: 'aws-pro-redshift', label: 'Redshift' },
  // Networking
  { id: 'aws-pro-vpc', label: 'VPC' },
  { id: 'aws-pro-cloudfront', label: 'CloudFront' },
  { id: 'aws-pro-route53', label: 'Route 53' },
  { id: 'aws-pro-elb', label: 'ELB/ALB' },
  { id: 'aws-pro-api-gateway', label: 'API Gateway' },
  { id: 'aws-pro-direct-connect', label: 'Direct Connect' },
  // Security
  { id: 'aws-pro-iam', label: 'IAM' },
  { id: 'aws-pro-waf', label: 'WAF' },
  { id: 'aws-pro-shield', label: 'Shield' },
  { id: 'aws-pro-kms', label: 'KMS' },
  { id: 'aws-pro-cognito', label: 'Cognito' },
  // Management
  { id: 'aws-pro-cloudwatch', label: 'CloudWatch' },
  { id: 'aws-pro-cloudformation', label: 'CloudFormation' },
  { id: 'aws-pro-cloudtrail', label: 'CloudTrail' },
  // Messaging
  { id: 'aws-pro-sqs', label: 'SQS' },
  { id: 'aws-pro-sns', label: 'SNS' },
  { id: 'aws-pro-eventbridge', label: 'EventBridge' },
];

// ── Individual stencil registration ───────────────────────

describe('getStencil — aws-pro stencils', () => {
  for (const { id, label } of AWS_PRO_STENCILS) {
    it(`returns the ${id} stencil entry`, async () => {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
      expect(entry!.category).toBe('aws-pro');
      expect(entry!.label).toBe(label);
      expect(entry!.svgContent).toContain('<svg');
      expect(entry!.svgContent).toContain('</svg>');
      expect(entry!.svgContent).toContain('currentColor');
      expect(entry!.defaultSize).toEqual({ width: 44, height: 44 });
    });
  }
});

// ── SVG structure validation ──────────────────────────────

describe('aws-pro SVG structure', () => {
  it('all aws-pro SVGs use viewBox="0 0 64 64"', async () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('viewBox="0 0 64 64"');
    }
  });

  it('all aws-pro SVGs contain xmlns attribute', async () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.svgContent).toContain('xmlns="http://www.w3.org/2000/svg"');
    }
  });

  it('all aws-pro SVGs are well-formed (start with <svg, end with </svg>)', async () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      const svg = entry!.svgContent.trim();
      expect(svg.startsWith('<svg')).toBe(true);
      expect(svg.endsWith('</svg>')).toBe(true);
    }
  });
});

// ── Category count ────────────────────────────────────────

describe('aws-pro category', () => {
  it('returns 32 stencils in the aws-pro category', () => {
    const entries = getStencilsByCategory('aws-pro');
    expect(entries).toHaveLength(32);
  });

  it('contains all expected stencil IDs sorted', () => {
    const entries = getStencilsByCategory('aws-pro');
    const ids = entries.map((e) => e.id).sort();
    expect(ids).toEqual([
      'aws-pro-api-gateway',
      'aws-pro-aurora',
      'aws-pro-cloudformation',
      'aws-pro-cloudfront',
      'aws-pro-cloudtrail',
      'aws-pro-cloudwatch',
      'aws-pro-cognito',
      'aws-pro-direct-connect',
      'aws-pro-dynamodb',
      'aws-pro-ebs',
      'aws-pro-ec2',
      'aws-pro-ecs',
      'aws-pro-efs',
      'aws-pro-eks',
      'aws-pro-elasticache',
      'aws-pro-elb',
      'aws-pro-eventbridge',
      'aws-pro-fargate',
      'aws-pro-glacier',
      'aws-pro-iam',
      'aws-pro-kms',
      'aws-pro-lambda',
      'aws-pro-lightsail',
      'aws-pro-rds',
      'aws-pro-redshift',
      'aws-pro-route53',
      'aws-pro-s3',
      'aws-pro-shield',
      'aws-pro-sns',
      'aws-pro-sqs',
      'aws-pro-vpc',
      'aws-pro-waf',
    ]);
  });

  it('aws-pro is listed in getAllCategories', () => {
    const categories = getAllCategories();
    expect(categories).toContain('aws-pro');
  });
});

// ── Catalog integrity ─────────────────────────────────────

describe('aws-pro catalog integrity', () => {
  it('catalog map keys match entry IDs for all aws-pro stencils', () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = STENCIL_CATALOG.get(id);
      expect(entry).toBeDefined();
      expect(entry!.id).toBe(id);
    }
  });

  it('all aws-pro stencils have non-empty labels', async () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.label.length).toBeGreaterThan(0);
    }
  });

  it('all aws-pro stencils have positive default dimensions', async () => {
    for (const { id } of AWS_PRO_STENCILS) {
      const entry = await getStencil(id);
      expect(entry).toBeDefined();
      expect(entry!.defaultSize.width).toBeGreaterThan(0);
      expect(entry!.defaultSize.height).toBeGreaterThan(0);
    }
  });
});
