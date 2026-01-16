/**
 * Enrichment Engine Test Suite
 *
 * Tests the BD data enrichment pipeline:
 * 1. Job-to-Program matching
 * 2. Contact discovery for programs
 * 3. BD priority calculation
 * 4. Playbook generation
 */

import type { NotionJob, NotionProgram, NotionContact } from '../services/notionApi';
import { enrichAllJobs, matchJobToProgram, findContactsForProgram, getEnrichmentStats } from '../services/enrichmentEngine';
import { generateDailyPlaybook } from '../services/playbookGenerator';

// Sample test data - Jobs
const SAMPLE_JOBS: NotionJob[] = [
  {
    id: 'job-001',
    title: 'Senior Cloud Engineer - DCGS Program',
    program: 'DCGS-A',
    agency: 'Army',
    bd_priority: 8,
    clearance: 'TS/SCI',
    functional_area: 'Engineering',
    status: 'Active',
    location: 'Wright-Patterson AFB',
    city: 'Dayton',
    company: 'GDIT',
    task_order: 'TO-2024-001',
    source_url: 'https://jobs.example.com/1',
    scraped_at: '2024-01-15',
    dcgs_relevance: true,
  },
  {
    id: 'job-002',
    title: 'Cybersecurity Analyst',
    program: 'DES',
    agency: 'DISA',
    bd_priority: 6,
    clearance: 'Secret',
    functional_area: 'Cyber',
    status: 'Active',
    location: 'Fort Meade',
    city: 'Fort Meade',
    company: 'Leidos',
    task_order: 'TO-2024-002',
    source_url: 'https://jobs.example.com/2',
    scraped_at: '2024-01-15',
    dcgs_relevance: false,
  },
  {
    id: 'job-003',
    title: 'Intelligence Analyst - ISR Support',
    program: '',
    agency: 'Air Force',
    bd_priority: 7,
    clearance: 'TS/SCI with Poly',
    functional_area: 'Intelligence',
    status: 'Active',
    location: 'Langley AFB',
    city: 'Hampton',
    company: 'Northrop Grumman',
    task_order: '',
    source_url: 'https://jobs.example.com/3',
    scraped_at: '2024-01-15',
    dcgs_relevance: true,
  },
  {
    id: 'job-004',
    title: 'Space Systems Engineer',
    program: 'MDA',
    agency: 'MDA',
    bd_priority: 5,
    clearance: 'Top Secret',
    functional_area: 'Engineering',
    status: 'Active',
    location: 'Colorado Springs',
    city: 'Colorado Springs',
    company: 'L3Harris',
    task_order: 'TO-2024-003',
    source_url: 'https://jobs.example.com/4',
    scraped_at: '2024-01-15',
    dcgs_relevance: false,
  },
];

// Sample test data - Programs
const SAMPLE_PROGRAMS: NotionProgram[] = [
  {
    id: 'prog-001',
    name: 'Distributed Common Ground System - Army',
    acronym: 'DCGS-A',
    agency_owner: 'Army',
    prime_contractor_ids: ['gdit-001'],
    bd_priority: 'Critical',
    program_type: 'ISR',
    contract_vehicle: 'OASIS',
    contract_value: '$2.5B',
    key_locations: 'Wright-Patterson AFB, Fort Huachuca',
    clearance_requirements: ['TS/SCI'],
    period_of_performance: '2020-2025',
    recompete_date: '2025-06-01',
    hiring_velocity: 'High',
    pts_involvement: 'Active',
    notes: 'Critical DCGS program with PTS involvement',
  },
  {
    id: 'prog-002',
    name: 'Defense Enclave Services',
    acronym: 'DES',
    agency_owner: 'DISA',
    prime_contractor_ids: ['gdit-001'],
    bd_priority: 'High',
    program_type: 'Enterprise IT',
    contract_vehicle: 'GSA',
    contract_value: '$1.8B',
    key_locations: 'Fort Meade, Pentagon',
    clearance_requirements: ['Secret', 'Top Secret'],
    period_of_performance: '2021-2026',
    recompete_date: '2026-03-01',
    hiring_velocity: 'Medium',
    pts_involvement: 'Supporting',
    notes: 'Enterprise IT modernization',
  },
  {
    id: 'prog-003',
    name: 'AF Distributed Common Ground System',
    acronym: 'AF DCGS',
    agency_owner: 'Air Force',
    prime_contractor_ids: ['ng-001'],
    bd_priority: 'High',
    program_type: 'ISR',
    contract_vehicle: 'IDIQ',
    contract_value: '$3.1B',
    key_locations: 'Langley AFB, Beale AFB',
    clearance_requirements: ['TS/SCI', 'Poly'],
    period_of_performance: '2019-2029',
    recompete_date: '2029-01-01',
    hiring_velocity: 'High',
    pts_involvement: 'Active',
    notes: 'Air Force DCGS ISR program',
  },
  {
    id: 'prog-004',
    name: 'Missile Defense Agency',
    acronym: 'MDA',
    agency_owner: 'DoD',
    prime_contractor_ids: ['l3h-001'],
    bd_priority: 'Medium',
    program_type: 'Space',
    contract_vehicle: 'SEWP',
    contract_value: '$500M',
    key_locations: 'Colorado Springs, Huntsville',
    clearance_requirements: ['Top Secret'],
    period_of_performance: '2022-2027',
    recompete_date: '2027-06-01',
    hiring_velocity: 'Low',
    pts_involvement: 'None',
    notes: 'Space-based defense systems',
  },
];

// Sample test data - Contacts
const SAMPLE_CONTACTS: NotionContact[] = [
  {
    id: 'contact-001',
    name: 'John Smith',
    firstName: 'John',
    title: 'Program Manager',
    email: 'john.smith@gdit.com',
    phone: '555-0101',
    linkedin: 'https://linkedin.com/in/johnsmith',
    company: 'GDIT',
    program: 'DCGS-A',
    tier: 2,
    bdPriority: 'Critical',
    relationshipStrength: 'Strong',
    functionalArea: ['Program Management'],
    locationHub: 'Wright-Patterson',
    lastContactDate: '2024-01-10',
    nextOutreachDate: new Date().toISOString().split('T')[0], // Today
    outreachHistory: 'Regular meetings',
    sourceDb: 'GDIT',
  },
  {
    id: 'contact-002',
    name: 'Jane Doe',
    firstName: 'Jane',
    title: 'Technical Lead',
    email: 'jane.doe@disa.mil',
    phone: '555-0102',
    linkedin: '',
    company: 'DISA',
    program: 'Defense Enclave Services',
    tier: 3,
    bdPriority: 'High',
    relationshipStrength: 'Developing',
    functionalArea: ['Engineering', 'Cyber'],
    locationHub: 'Fort Meade',
    lastContactDate: '2024-01-05',
    nextOutreachDate: new Date().toISOString().split('T')[0], // Today
    outreachHistory: 'Initial outreach',
    sourceDb: 'DCGS',
  },
  {
    id: 'contact-003',
    name: 'Mike Johnson',
    firstName: 'Mike',
    title: 'Director of ISR',
    email: 'mike.johnson@usaf.mil',
    phone: '',
    linkedin: 'https://linkedin.com/in/mikejohnson',
    company: 'US Air Force',
    program: 'AF DCGS',
    tier: 1,
    bdPriority: 'Critical',
    relationshipStrength: 'Strong',
    functionalArea: ['Intelligence', 'Leadership'],
    locationHub: 'Langley',
    lastContactDate: '2024-01-12',
    nextOutreachDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], // 7 days from now
    outreachHistory: 'Executive relationship',
    sourceDb: 'DCGS',
  },
];

// Test Runner
function runTests(): void {
  console.log('='.repeat(60));
  console.log('BD ENRICHMENT ENGINE TEST SUITE');
  console.log('='.repeat(60));
  console.log('');

  // Test 1: Job-to-Program Matching
  console.log('TEST 1: Job-to-Program Matching');
  console.log('-'.repeat(40));

  SAMPLE_JOBS.forEach(job => {
    const match = matchJobToProgram(job, SAMPLE_PROGRAMS);
    if (match) {
      console.log(`✓ Job: "${job.title}"`);
      console.log(`  → Matched: ${match.program.name} (score: ${match.score})`);
      console.log(`  → Reasons: ${match.reasons.join(', ')}`);
    } else {
      console.log(`✗ Job: "${job.title}" - No match found`);
    }
  });
  console.log('');

  // Test 2: Contact Discovery
  console.log('TEST 2: Contact Discovery for Programs');
  console.log('-'.repeat(40));

  SAMPLE_PROGRAMS.forEach(program => {
    const contacts = findContactsForProgram(program, SAMPLE_CONTACTS);
    console.log(`Program: ${program.name}`);
    if (contacts.length > 0) {
      contacts.forEach(c => {
        console.log(`  ✓ ${c.name} (${c.title}) - ${c.relationshipStrength}`);
      });
    } else {
      console.log('  - No contacts found');
    }
  });
  console.log('');

  // Test 3: Full Job Enrichment
  console.log('TEST 3: Full Job Enrichment Pipeline');
  console.log('-'.repeat(40));

  const enrichedJobs = enrichAllJobs(SAMPLE_JOBS, SAMPLE_PROGRAMS, SAMPLE_CONTACTS);

  enrichedJobs.forEach(ej => {
    console.log(`Job: "${ej.job.title}"`);
    console.log(`  Priority: ${ej.bdPriority.toUpperCase()}`);
    console.log(`  Program: ${ej.matchedProgram?.name || 'Not matched'}`);
    console.log(`  Match Score: ${ej.matchScore}`);
    console.log(`  Contacts: ${ej.relatedContacts.length}`);
    console.log(`  Actions: ${ej.suggestedActions.slice(0, 2).join('; ')}`);
    console.log('');
  });

  // Test 4: Enrichment Statistics
  console.log('TEST 4: Enrichment Statistics');
  console.log('-'.repeat(40));

  const stats = getEnrichmentStats(enrichedJobs);
  console.log(`Total Jobs: ${stats.totalJobs}`);
  console.log(`Matched to Program: ${stats.matchedToProgram} (${Math.round(stats.matchRate * 100)}%)`);
  console.log(`With Contacts: ${stats.withContacts}`);
  console.log(`By Priority:`);
  Object.entries(stats.byPriority).forEach(([priority, count]) => {
    console.log(`  ${priority}: ${count}`);
  });
  console.log(`Top Programs:`);
  stats.topPrograms.forEach(p => {
    console.log(`  ${p.name}: ${p.count} jobs`);
  });
  console.log('');

  // Test 5: Playbook Generation
  console.log('TEST 5: Playbook Generation');
  console.log('-'.repeat(40));

  const today = new Date();
  const playbook = generateDailyPlaybook(enrichedJobs, SAMPLE_CONTACTS, SAMPLE_PROGRAMS, today);

  console.log(`Date: ${today.toLocaleDateString()}`);
  console.log(`Total Tasks: ${playbook.stats.total}`);
  console.log(`By Priority:`);
  Object.entries(playbook.stats.byPriority).forEach(([priority, count]) => {
    if (count > 0) console.log(`  ${priority}: ${count}`);
  });
  console.log(`By Type:`);
  Object.entries(playbook.stats.byType).forEach(([type, count]) => {
    if (count > 0) console.log(`  ${type}: ${count}`);
  });
  console.log('');
  console.log('Generated Tasks:');
  playbook.tasks.forEach(task => {
    const timeStr = task.time ? `[${task.time}] ` : '';
    console.log(`  ${timeStr}[${task.priority.toUpperCase()}] ${task.title}`);
    console.log(`    Type: ${task.type} | Source: ${task.sourceType}`);
    if (task.contact) console.log(`    Contact: ${task.contact}`);
    if (task.program) console.log(`    Program: ${task.program}`);
  });
  console.log('');

  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`✓ Job-to-Program matching: ${enrichedJobs.filter(e => e.matchedProgram).length}/${enrichedJobs.length} matched`);
  console.log(`✓ Contact discovery: ${enrichedJobs.filter(e => e.relatedContacts.length > 0).length}/${enrichedJobs.length} with contacts`);
  console.log(`✓ Playbook generation: ${playbook.tasks.length} tasks generated`);
  console.log('');
  console.log('All tests completed!');
}

// Export for use in React or Node.js
export { runTests, SAMPLE_JOBS, SAMPLE_PROGRAMS, SAMPLE_CONTACTS };
