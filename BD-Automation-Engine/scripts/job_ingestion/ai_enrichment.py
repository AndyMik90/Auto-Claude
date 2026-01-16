"""
AI Enrichment Engine - Uses Claude to extract structured data from job descriptions.

Extracts:
- Experience (Years)
- Top 3 Skills
- Top 3 Technologies
- Required Certifications
- Optional/Desired Certifications
- Clearance (if not already extracted)
"""

import os
import json
import re
import logging
from typing import Dict, List, Optional, Any
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger('BD-AIEnrichment')

# Try to import Anthropic
try:
    from anthropic import Anthropic
    HAS_ANTHROPIC = True
except ImportError:
    HAS_ANTHROPIC = False
    logger.warning("anthropic not installed. AI enrichment disabled.")


@dataclass
class EnrichmentResult:
    """Result from AI enrichment."""
    experience_years: Optional[int] = None
    skills: Optional[str] = None  # Comma-separated top 3
    technologies: Optional[str] = None  # Comma-separated top 3
    certifications_required: Optional[str] = None
    certifications_extra: Optional[str] = None
    clearance_detected: Optional[str] = None
    raw_response: Optional[Dict] = None


# ===========================================
# ENRICHMENT PROMPTS
# ===========================================

EXTRACTION_PROMPT = """Analyze this job description and extract the following information.
Return your response as valid JSON only, no other text.

Job Description:
{description}

Extract:
1. experience_years: The minimum years of experience required (integer, or null if not specified)
2. skills: The top 3 most important/unique skills for this role (comma-separated string, be specific to this job)
3. technologies: The top 3 most important technologies/tools/platforms (comma-separated string)
4. certifications_required: Any required certifications mentioned (comma-separated string, or null)
5. certifications_extra: Any preferred/desired/nice-to-have certifications (comma-separated string, or null)
6. clearance_level: The security clearance level mentioned (one of: "Public Trust", "Secret", "Top Secret", "TS/SCI", "TS/SCI CI Poly", "TS/SCI FS Poly", or null)

Response format (JSON only):
{{
  "experience_years": <int or null>,
  "skills": "<skill1>, <skill2>, <skill3>" or null,
  "technologies": "<tech1>, <tech2>, <tech3>" or null,
  "certifications_required": "<cert1>, <cert2>" or null,
  "certifications_extra": "<cert1>, <cert2>" or null,
  "clearance_level": "<level>" or null
}}"""


# ===========================================
# ENRICHMENT ENGINE
# ===========================================

class AIEnrichmentEngine:
    """Engine for AI-powered job enrichment using Claude."""

    def __init__(self, api_key: str = None, model: str = "claude-sonnet-4-20250514"):
        self.api_key = api_key or os.getenv('ANTHROPIC_API_KEY')
        self.model = model
        self._client = None

    @property
    def client(self):
        """Get Anthropic client (lazy initialization)."""
        if not HAS_ANTHROPIC:
            raise RuntimeError("anthropic not installed. Run: pip install anthropic")

        if self._client is None:
            if not self.api_key:
                raise ValueError("ANTHROPIC_API_KEY not configured")
            self._client = Anthropic(api_key=self.api_key)

        return self._client

    def enrich_job(self, description: str) -> EnrichmentResult:
        """Extract structured data from a job description using Claude."""
        if not description or len(description.strip()) < 50:
            logger.warning("Description too short for enrichment")
            return EnrichmentResult()

        # Truncate very long descriptions
        if len(description) > 15000:
            description = description[:15000] + "..."

        prompt = EXTRACTION_PROMPT.format(description=description)

        try:
            response = self.client.messages.create(
                model=self.model,
                max_tokens=1024,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )

            # Extract text content
            text = response.content[0].text.strip()

            # Parse JSON response
            # Handle markdown code blocks
            if text.startswith('```'):
                text = re.sub(r'^```(?:json)?\s*', '', text)
                text = re.sub(r'\s*```$', '', text)

            data = json.loads(text)

            return EnrichmentResult(
                experience_years=data.get('experience_years'),
                skills=data.get('skills'),
                technologies=data.get('technologies'),
                certifications_required=data.get('certifications_required'),
                certifications_extra=data.get('certifications_extra'),
                clearance_detected=data.get('clearance_level'),
                raw_response=data
            )

        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse Claude response as JSON: {e}")
            return EnrichmentResult()
        except Exception as e:
            logger.error(f"AI enrichment failed: {e}")
            return EnrichmentResult()

    def enrich_jobs_batch(self, jobs: List[Dict], description_key: str = 'description') -> List[Dict]:
        """Enrich a batch of jobs with AI-extracted data.

        Args:
            jobs: List of job dictionaries
            description_key: Key for the description field

        Returns:
            Jobs with enrichment fields added
        """
        enriched = []

        for i, job in enumerate(jobs):
            logger.info(f"Enriching job {i+1}/{len(jobs)}: {job.get('title', 'Unknown')[:50]}")

            description = job.get(description_key, '')
            result = self.enrich_job(description)

            # Merge enrichment into job
            job_copy = job.copy()

            if result.experience_years is not None:
                job_copy['experience_years'] = result.experience_years

            if result.skills:
                job_copy['skills'] = result.skills

            if result.technologies:
                job_copy['technologies'] = result.technologies

            if result.certifications_required:
                job_copy['certifications_required'] = result.certifications_required

            if result.certifications_extra:
                job_copy['certifications_extra'] = result.certifications_extra

            # Only override clearance if not already set
            if result.clearance_detected and not job_copy.get('clearance'):
                job_copy['clearance'] = result.clearance_detected

            enriched.append(job_copy)

        return enriched


# ===========================================
# FALLBACK EXTRACTION (No API Required)
# ===========================================

def extract_experience_fallback(description: str) -> Optional[int]:
    """Extract years of experience using regex patterns."""
    patterns = [
        r'(\d+)\+?\s*years?\s*(?:of\s+)?(?:experience|exp)',
        r'(?:minimum|min|at\s+least)\s*(\d+)\s*years?',
        r'(\d+)\s*years?\s*(?:minimum|min)',
        r'experience[:\s]+(\d+)\+?\s*years?',
    ]

    for pattern in patterns:
        match = re.search(pattern, description, re.IGNORECASE)
        if match:
            try:
                return int(match.group(1))
            except ValueError:
                continue

    return None


def extract_certifications_fallback(description: str) -> tuple[Optional[str], Optional[str]]:
    """Extract certifications using pattern matching."""
    # Common certification patterns
    cert_patterns = [
        r'Security\+',
        r'CISSP',
        r'CISM',
        r'CEH',
        r'CompTIA\s+\w+',
        r'AWS\s+Certified\s+\w+',
        r'Azure\s+\w+',
        r'PMP',
        r'CCNA',
        r'CCNP',
        r'CCIE',
        r'ITIL',
        r'IAT\s+Level\s+[I]+',
        r'8570\s+\w+',
        r'Red\s+Hat\s+\w+',
        r'Kubernetes\s+\w+',
    ]

    found = []
    for pattern in cert_patterns:
        matches = re.findall(pattern, description, re.IGNORECASE)
        found.extend(matches)

    if not found:
        return None, None

    # Try to separate required vs preferred
    required_section = re.search(r'required.*?(?=preferred|nice|desired|$)', description, re.IGNORECASE | re.DOTALL)
    preferred_section = re.search(r'(?:preferred|nice|desired).*', description, re.IGNORECASE | re.DOTALL)

    required_certs = []
    extra_certs = []

    for cert in set(found):
        cert_lower = cert.lower()
        if required_section and cert_lower in required_section.group().lower():
            required_certs.append(cert)
        elif preferred_section and cert_lower in preferred_section.group().lower():
            extra_certs.append(cert)
        else:
            required_certs.append(cert)  # Default to required

    required_str = ', '.join(required_certs[:5]) if required_certs else None
    extra_str = ', '.join(extra_certs[:5]) if extra_certs else None

    return required_str, extra_str


class FallbackEnrichmentEngine:
    """Fallback enrichment using regex patterns (no API required)."""

    def enrich_job(self, description: str) -> EnrichmentResult:
        """Extract data using regex patterns."""
        experience = extract_experience_fallback(description)
        req_certs, extra_certs = extract_certifications_fallback(description)

        return EnrichmentResult(
            experience_years=experience,
            certifications_required=req_certs,
            certifications_extra=extra_certs
        )


# ===========================================
# CLI INTERFACE
# ===========================================

def main():
    """CLI for testing AI enrichment."""
    import argparse

    parser = argparse.ArgumentParser(description='AI Enrichment Engine')
    parser.add_argument('--input', '-i', required=True, help='Input JSON file with jobs')
    parser.add_argument('--output', '-o', help='Output JSON file')
    parser.add_argument('--limit', '-l', type=int, help='Limit number of jobs to process')
    parser.add_argument('--fallback', action='store_true', help='Use fallback (no API)')
    parser.add_argument('--test', action='store_true', help='Test with single job')

    args = parser.parse_args()

    # Load jobs
    with open(args.input, 'r', encoding='utf-8') as f:
        jobs = json.load(f)

    if isinstance(jobs, dict):
        jobs = [jobs]

    if args.limit:
        jobs = jobs[:args.limit]

    print(f"Loaded {len(jobs)} jobs")

    # Choose engine
    if args.fallback:
        print("Using fallback extraction (no API)")
        engine = FallbackEnrichmentEngine()
    else:
        print("Using Claude AI enrichment")
        engine = AIEnrichmentEngine()

    if args.test and jobs:
        # Test single job
        job = jobs[0]
        print(f"\nTest job: {job.get('title', job.get('jobTitle', 'Unknown'))}")
        print(f"Description length: {len(job.get('description', ''))}")

        result = engine.enrich_job(job.get('description', ''))
        print(f"\nEnrichment Result:")
        print(f"  Experience: {result.experience_years} years")
        print(f"  Skills: {result.skills}")
        print(f"  Technologies: {result.technologies}")
        print(f"  Certs Required: {result.certifications_required}")
        print(f"  Certs Extra: {result.certifications_extra}")
        print(f"  Clearance: {result.clearance_detected}")
        return

    # Batch enrichment
    enriched = engine.enrich_jobs_batch(jobs)

    if args.output:
        with open(args.output, 'w', encoding='utf-8') as f:
            json.dump(enriched, f, indent=2)
        print(f"\nSaved enriched jobs to: {args.output}")

    # Summary
    with_experience = sum(1 for j in enriched if j.get('experience_years'))
    with_skills = sum(1 for j in enriched if j.get('skills'))
    with_certs = sum(1 for j in enriched if j.get('certifications_required'))

    print(f"\nEnrichment Summary:")
    print(f"  Jobs with experience: {with_experience}/{len(enriched)}")
    print(f"  Jobs with skills: {with_skills}/{len(enriched)}")
    print(f"  Jobs with certifications: {with_certs}/{len(enriched)}")


if __name__ == '__main__':
    main()
