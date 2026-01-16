#!/usr/bin/env python3
"""
Convert all BD data files to JSON for the dashboard.
Outputs to dashboard/public/data/
"""

import json
import csv
import os
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).parent.parent
OUTPUT_DIR = BASE_DIR / "dashboard" / "public" / "data"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def load_csv(filepath):
    """Load CSV file and return list of dicts."""
    rows = []
    with open(filepath, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Clean up empty strings
            cleaned = {k: v.strip() if v else None for k, v in row.items()}
            rows.append(cleaned)
    return rows

def load_json(filepath):
    """Load JSON file."""
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def save_json(data, filename):
    """Save data to JSON file in output directory."""
    filepath = OUTPUT_DIR / filename
    with open(filepath, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2, default=str)
    print(f"Saved: {filepath}")

def convert_jobs():
    """Convert job scrape data to unified format."""
    jobs = []
    job_id = 1

    # Load JSON scrapes
    scrape_files = [
        BASE_DIR / "Engine1_Scraper" / "data" / "Apex Job Scrape.json",
        BASE_DIR / "Engine1_Scraper" / "data" / "Apex Job Scrape2.json",
        BASE_DIR / "Engine1_Scraper" / "data" / "Insight Global Scrape.json",
    ]

    for filepath in scrape_files:
        if filepath.exists():
            data = load_json(filepath)
            source = "Apex" if "Apex" in filepath.name else "Insight Global"
            for item in data:
                jobs.append({
                    "id": f"job-{job_id}",
                    "title": item.get("jobTitle", ""),
                    "location": item.get("location", ""),
                    "datePosted": item.get("datePosted", ""),
                    "description": item.get("description", "")[:500] + "..." if item.get("description") else "",
                    "securityClearance": item.get("securityClearance", ""),
                    "employmentType": item.get("employmentType", "Contract"),
                    "payRate": item.get("payRate", ""),
                    "duration": item.get("duration", ""),
                    "url": item.get("url", ""),
                    "source": source,
                    "status": "Open",
                    "program": None,
                    "company": source,
                })
                job_id += 1
            print(f"Loaded {len(data)} jobs from {filepath.name}")

    # Load GDIT Jobs CSV
    gdit_jobs_path = BASE_DIR / "Engine2_ProgramMapping" / "data" / "GDIT Jobs 2All.csv"
    if gdit_jobs_path.exists():
        gdit_data = load_csv(gdit_jobs_path)
        for item in gdit_data:
            name = item.get("Name", "")
            jobs.append({
                "id": f"job-{job_id}",
                "title": item.get("Job Title") or name.split("|")[-1].strip() if "|" in name else name,
                "location": item.get("Location", ""),
                "datePosted": item.get("Date Added", ""),
                "description": "",
                "securityClearance": "",
                "employmentType": item.get("Employment Type", "Contract"),
                "payRate": item.get("Pay Rate", ""),
                "duration": "",
                "url": "",
                "source": "GDIT",
                "status": item.get("Status") or item.get("Open/Closed", "Open"),
                "program": item.get("Program", ""),
                "company": "GDIT",
                "clientBillRate": item.get("Client Bill Rate", ""),
                "owner": item.get("Owner", ""),
            })
            job_id += 1
        print(f"Loaded {len(gdit_data)} jobs from GDIT Jobs CSV")

    save_json(jobs, "jobs.json")
    return jobs

def convert_programs():
    """Convert federal programs data."""
    programs_path = BASE_DIR / "Engine2_ProgramMapping" / "data" / "Federal ProgramsAll.csv"
    programs = []

    if programs_path.exists():
        data = load_csv(programs_path)
        for i, item in enumerate(data):
            programs.append({
                "id": f"prog-{i+1}",
                "name": item.get("Program Name", ""),
                "acronym": item.get("Acronym", ""),
                "agency": item.get("Agency Owner", ""),
                "budget": item.get("Budget", ""),
                "contractValue": item.get("Contract Value", ""),
                "clearanceRequirements": item.get("Clearance Requirements", ""),
                "primeContractor": item.get("Prime Contractor") or item.get("Prime Contractor 1", ""),
                "keyLocations": item.get("Key Locations", ""),
                "keySubcontractors": item.get("Key Subcontractors") or item.get("Known Subcontractors", ""),
                "programType": item.get("Program Type") or item.get("Program Type 1", ""),
                "priorityLevel": item.get("Priority Level", "Medium"),
                "periodOfPerformance": item.get("Period of Performance", ""),
                "popStart": item.get("PoP Start", ""),
                "popEnd": item.get("PoP End", ""),
                "contractVehicle": item.get("Contract Vehicle", ""),
                "notes": item.get("Notes", ""),
                "typicalRoles": item.get("Typical Roles", ""),
                "confidenceLevel": item.get("Confidence Level", ""),
            })
        print(f"Loaded {len(data)} programs")

    save_json(programs, "programs.json")
    return programs

def convert_contacts():
    """Convert contact data from multiple sources."""
    contacts = []
    contact_id = 1

    contact_files = [
        BASE_DIR / "Engine3_OrgChart" / "data" / "DCGS Contact SortedAll.csv",
        BASE_DIR / "Engine3_OrgChart" / "data" / "DCGS_ContactsAll.csv",
        BASE_DIR / "Engine3_OrgChart" / "data" / "GDIT PTS Contacts All.csv",
        BASE_DIR / "Engine3_OrgChart" / "data" / "GDIT_Other_Contacts.csv",
    ]

    seen = set()  # Track duplicates by email

    for filepath in contact_files:
        if filepath.exists():
            data = load_csv(filepath)
            source = filepath.stem
            for item in data:
                email = item.get("Email Address", "") or item.get("Email", "")
                if email and email in seen:
                    continue
                if email:
                    seen.add(email)

                name = item.get("Name", "") or f"{item.get('First Name', '')} {item.get('Last Name', '')}".strip()
                contacts.append({
                    "id": f"contact-{contact_id}",
                    "name": name,
                    "firstName": item.get("First Name", ""),
                    "lastName": item.get("Last Name") or item.get("Name", ""),
                    "jobTitle": item.get("Job Title", ""),
                    "email": email,
                    "phone": item.get("Phone Number") or item.get("Direct Phone Number") or item.get("Mobile phone", ""),
                    "linkedIn": item.get("LinkedIn Contact Profile URL", ""),
                    "city": item.get("Person City", ""),
                    "state": item.get("Person State", ""),
                    "company": "GDIT",
                    "source": source,
                    "tier": classify_contact_tier(item.get("Job Title", "")),
                })
                contact_id += 1
            print(f"Loaded {len(data)} contacts from {filepath.name}")

    save_json(contacts, "contacts.json")
    return contacts

def classify_contact_tier(job_title):
    """Classify contact into 6-tier hierarchy based on job title."""
    if not job_title:
        return 6

    title_lower = job_title.lower()

    # Tier 1: C-Suite
    if any(x in title_lower for x in ["ceo", "cto", "cio", "cfo", "president", "chief"]):
        return 1

    # Tier 2: VP/Director
    if any(x in title_lower for x in ["vice president", "vp", "director", "head of"]):
        return 2

    # Tier 3: Senior Manager
    if any(x in title_lower for x in ["senior manager", "sr. manager", "program manager"]):
        return 3

    # Tier 4: Manager
    if "manager" in title_lower:
        return 4

    # Tier 5: Senior Individual Contributor
    if any(x in title_lower for x in ["senior", "sr.", "lead", "principal"]):
        return 5

    # Tier 6: Individual Contributor
    return 6

def generate_summary(jobs, programs, contacts):
    """Generate executive summary stats."""
    summary = {
        "totalJobs": len(jobs),
        "openJobs": len([j for j in jobs if j.get("status") == "Open"]),
        "totalPrograms": len(programs),
        "highPriorityPrograms": len([p for p in programs if p.get("priorityLevel") == "High"]),
        "totalContacts": len(contacts),
        "tier1Contacts": len([c for c in contacts if c.get("tier") == 1]),
        "tier2Contacts": len([c for c in contacts if c.get("tier") == 2]),
        "tier3Contacts": len([c for c in contacts if c.get("tier") == 3]),
        "jobsBySource": {},
        "jobsByLocation": {},
        "programsByAgency": {},
        "contactsByTier": {1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0},
    }

    # Count jobs by source
    for job in jobs:
        source = job.get("source", "Unknown")
        summary["jobsBySource"][source] = summary["jobsBySource"].get(source, 0) + 1

        loc = job.get("location", "Unknown") or "Unknown"
        # Extract state from location
        if "," in loc:
            state = loc.split(",")[-1].strip()
        else:
            state = loc
        summary["jobsByLocation"][state] = summary["jobsByLocation"].get(state, 0) + 1

    # Count programs by agency
    for prog in programs:
        agency = prog.get("agency", "Unknown") or "Unknown"
        summary["programsByAgency"][agency] = summary["programsByAgency"].get(agency, 0) + 1

    # Count contacts by tier
    for contact in contacts:
        tier = contact.get("tier", 6)
        summary["contactsByTier"][tier] = summary["contactsByTier"].get(tier, 0) + 1

    save_json(summary, "summary.json")
    return summary

def main():
    print("Converting BD data files to JSON for dashboard...")
    print(f"Output directory: {OUTPUT_DIR}")
    print("-" * 50)

    jobs = convert_jobs()
    programs = convert_programs()
    contacts = convert_contacts()
    summary = generate_summary(jobs, programs, contacts)

    print("-" * 50)
    print(f"Summary: {summary['totalJobs']} jobs, {summary['totalPrograms']} programs, {summary['totalContacts']} contacts")
    print("Done!")

if __name__ == "__main__":
    main()
