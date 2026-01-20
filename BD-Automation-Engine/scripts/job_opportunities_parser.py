#!/usr/bin/env python3
"""
Job Opportunities Parser - Comprehensive BD Mapping Engine

Parses scraped job data, maps to programs/primes/task orders,
matches contacts, and generates data pull requests for gaps.
"""

import csv
import json
import os
import re
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# ============================================================================
# PROGRAM MAPPING RULES
# ============================================================================

PROGRAM_MAPPING = {
    # AF DCGS Programs
    "dcgs": {
        "program": "AF DCGS",
        "prime": "GDIT",
        "keywords": ["dcgs", "distributed common ground", "isr wing", "480th", "548th"],
        "locations": ["langley", "hampton", "beale", "wright-patt", "dayton", "hickam", "san diego"]
    },
    "nasic": {
        "program": "NASIC Support",
        "prime": "Multiple",
        "keywords": ["nasic", "national air and space intelligence"],
        "locations": ["wright-patterson", "dayton", "fairborn"]
    },

    # MDA Programs
    "mda_gmd": {
        "program": "GMD (Ground-based Midcourse Defense)",
        "prime": "Boeing / Northrop",
        "keywords": ["gmd", "ground-based midcourse", "missile defense", "mda", "ground systems"],
        "locations": ["huntsville", "redstone arsenal", "colorado springs", "schriever"]
    },
    "mda_ires": {
        "program": "IRES (Integrated Research & Development for Enterprise Solutions)",
        "prime": "Leidos",
        "keywords": ["ires", "missile defense agency", "mda"],
        "locations": ["huntsville", "colorado springs", "schriever"]
    },

    # Navy Programs
    "ngen": {
        "program": "NGEN (Next Generation Enterprise Network)",
        "prime": "Leidos",
        "keywords": ["ngen", "next generation enterprise network", "nmci"],
        "locations": ["norfolk", "san diego", "pearl harbor", "jacksonville"]
    },
    "navy_dcgs": {
        "program": "Navy DCGS-N",
        "prime": "GDIT / Raytheon",
        "keywords": ["dcgs-n", "navy dcgs", "fleet intel"],
        "locations": ["norfolk", "san diego", "pearl harbor"]
    },
    "navy_shipyard": {
        "program": "Navy Shipyard Programs",
        "prime": "Multiple",
        "keywords": ["submarine", "shipyard", "nnsy", "nns", "newport news", "naval shipyard"],
        "locations": ["norfolk", "chesapeake", "portsmouth", "newport news"]
    },

    # GDIT Programs
    "adcs": {
        "program": "ADCS (Air Defense Command & Control System)",
        "prime": "GDIT",
        "keywords": ["adcs", "air defense", "tyndall"],
        "locations": ["tyndall", "panama city"]
    },
    "justified": {
        "program": "JUSTIFIED",
        "prime": "GDIT",
        "keywords": ["justified"],
        "locations": ["multiple"]
    },
    "centcom_cits": {
        "program": "CENTCOM/CITS",
        "prime": "GDIT",
        "keywords": ["centcom", "cits", "central command"],
        "locations": ["tampa", "macdill", "kuwait", "qatar"]
    },

    # Space Force Programs
    "ussf_space": {
        "program": "Space Force Ground Systems",
        "prime": "Multiple",
        "keywords": ["space force", "sda", "space development agency", "satellite ground", "vandenberg"],
        "locations": ["vandenberg", "colorado springs", "schriever", "peterson", "aurora"]
    },

    # Army Programs
    "army_cyber": {
        "program": "Army ARCYBER",
        "prime": "Multiple",
        "keywords": ["arcyber", "army cyber", "inscom"],
        "locations": ["fort meade", "fort gordon", "fort belvoir"]
    },
    "army_devcom": {
        "program": "Army DEVCOM/AMC",
        "prime": "Multiple",
        "keywords": ["devcom", "amc", "army materiel command"],
        "locations": ["redstone", "aberdeen", "picatinny"]
    },

    # DoD Enterprise
    "dod_pentagon": {
        "program": "DoD Financial Systems / PPBE",
        "prime": "Multiple",
        "keywords": ["pentagon", "dod financial", "ppbe", "ousd", "comptroller"],
        "locations": ["pentagon", "arlington", "washington"]
    },
    "disa": {
        "program": "DISA Programs",
        "prime": "Multiple",
        "keywords": ["disa", "defense information systems"],
        "locations": ["fort meade", "scott afb"]
    },

    # IC Programs
    "ic_nsa": {
        "program": "NSA Programs",
        "prime": "Multiple",
        "keywords": ["nsa", "national security agency", "sigint"],
        "locations": ["fort meade", "augusta"]
    },
    "ic_nga": {
        "program": "NGA Programs",
        "prime": "Multiple",
        "keywords": ["nga", "national geospatial", "geoint"],
        "locations": ["springfield", "st. louis"]
    },
    "ic_nro": {
        "program": "NRO Programs",
        "prime": "Multiple",
        "keywords": ["nro", "national reconnaissance"],
        "locations": ["chantilly", "aurora"]
    },

    # Civilian Federal
    "cms": {
        "program": "CMS (Centers for Medicare & Medicaid)",
        "prime": "Multiple",
        "keywords": ["cms", "medicare", "medicaid", "hhs"],
        "locations": ["baltimore", "woodlawn"]
    },

    # Defense Contractors (for identification)
    "raytheon": {
        "program": "Raytheon Programs",
        "prime": "Raytheon",
        "keywords": ["raytheon", "rtx", "rmd", "missile systems"],
        "locations": ["tucson", "el segundo", "andover"]
    },
    "lockheed": {
        "program": "Lockheed Martin Programs",
        "prime": "Lockheed Martin",
        "keywords": ["lockheed", "lm ", "f-35", "f-22"],
        "locations": ["fort worth", "marietta", "orlando"]
    },
    "northrop": {
        "program": "Northrop Grumman Programs",
        "prime": "Northrop Grumman",
        "keywords": ["northrop", "ngc", "gbsd", "sentinel"],
        "locations": ["palmdale", "redondo beach", "huntsville"]
    }
}

# Prime contractor identification
PRIME_IDENTIFICATION = {
    "gdit": ["gdit", "general dynamics information technology", "general dynamics it"],
    "leidos": ["leidos"],
    "raytheon": ["raytheon", "rtx", "rmd"],
    "lockheed": ["lockheed", "lm "],
    "northrop": ["northrop", "ngc"],
    "boeing": ["boeing"],
    "bae": ["bae systems", "bae "],
    "saic": ["saic", "science applications"],
    "peraton": ["peraton"],
    "booz_allen": ["booz allen", "booz"],
    "caci": ["caci"],
    "mantech": ["mantech"],
    "parsons": ["parsons"],
    "kbr": ["kbr"],
    "jacobs": ["jacobs"]
}


# ============================================================================
# DATA LOADING
# ============================================================================

def load_scrape_files(data_dir: str) -> List[Dict]:
    """Load all today's scrape files."""
    jobs = []

    scrape_files = [
        "dataset_puppeteer-scraper_2026-01-19_13-00-08-552-Apex-Systems.json",
        "dataset_puppeteer-scraper_2026-01-19_13-10-22-621-Insight-Global-Cleared-Jobs-USA.json",
        "dataset_puppeteer-scraper_2026-01-19_13-25-19-708-Apex-Systems2.json"
    ]

    for filename in scrape_files:
        filepath = os.path.join(data_dir, filename)
        if os.path.exists(filepath):
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
                source = "Apex Systems" if "Apex" in filename else "Insight Global"
                for job in data:
                    job["source"] = source
                    jobs.append(job)
                print(f"Loaded {len(data)} jobs from {filename}")

    return jobs


def load_federal_programs(filepath: str) -> List[Dict]:
    """Load federal programs database."""
    programs = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            programs = list(reader)
            print(f"Loaded {len(programs)} federal programs")
    except Exception as e:
        print(f"Error loading programs: {e}")
    return programs


def load_contacts(contacts_file: str) -> List[Dict]:
    """Load contact database."""
    contacts = []
    try:
        with open(contacts_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            contacts = list(reader)
            print(f"Loaded {len(contacts)} contacts")
    except Exception as e:
        print(f"Error loading contacts: {e}")
    return contacts


# ============================================================================
# MAPPING FUNCTIONS
# ============================================================================

def extract_clearance(job: Dict) -> str:
    """Extract security clearance from job."""
    clearance = job.get("securityClearance", "") or ""
    description = job.get("description", "") or ""
    combined = f"{clearance} {description}".lower()

    if "ts/sci" in combined and ("poly" in combined or "fsp" in combined or "ci poly" in combined):
        return "TS/SCI w/ Poly"
    elif "ts/sci" in combined or "top secret/sci" in combined:
        return "TS/SCI"
    elif "top secret" in combined:
        return "Top Secret"
    elif "secret" in combined:
        return "Secret"
    elif "public trust" in combined:
        return "Public Trust"
    elif "clearable" in combined or "obtain" in combined:
        return "Clearance Required (Obtainable)"
    else:
        return "Unknown"


def identify_prime(job: Dict) -> str:
    """Identify the prime contractor from job description."""
    description = (job.get("description", "") or "").lower()
    title = (job.get("jobTitle", "") or "").lower()
    combined = f"{title} {description}"

    for prime, keywords in PRIME_IDENTIFICATION.items():
        for kw in keywords:
            if kw in combined:
                return prime.upper().replace("_", " ")

    return "Unknown"


def map_to_program(job: Dict) -> Tuple[str, str, str, int]:
    """Map job to program, prime, and task order. Returns (program, prime, task_order, confidence)."""
    title = (job.get("jobTitle", "") or "").lower()
    description = (job.get("description", "") or "").lower()
    location = (job.get("location", "") or "").lower()
    combined = f"{title} {description}"

    best_match = None
    best_score = 0

    for program_key, program_data in PROGRAM_MAPPING.items():
        score = 0

        # Check keywords
        for kw in program_data["keywords"]:
            if kw in combined:
                score += 3

        # Check locations
        for loc in program_data["locations"]:
            if loc in location:
                score += 2

        if score > best_score:
            best_score = score
            best_match = program_data

    if best_match and best_score >= 2:
        # Calculate confidence
        if best_score >= 5:
            confidence = 90
        elif best_score >= 3:
            confidence = 70
        else:
            confidence = 50

        # Determine task order from location
        task_order = determine_task_order(location, best_match["program"])

        return best_match["program"], best_match["prime"], task_order, confidence

    # Default mapping based on location
    location_defaults = {
        "huntsville": ("MDA / Army Programs", "Multiple", "Redstone Arsenal", 30),
        "redstone": ("Army Programs", "Multiple", "Redstone Arsenal", 30),
        "colorado springs": ("Space Force / MDA", "Multiple", "Schriever SFB", 30),
        "san diego": ("Navy / PACAF Programs", "Multiple", "San Diego Area", 30),
        "norfolk": ("Navy Programs", "Multiple", "Hampton Roads", 30),
        "washington": ("DoD Enterprise", "Multiple", "Pentagon Area", 30),
        "arlington": ("DoD Enterprise", "Multiple", "Pentagon Area", 30),
        "fort meade": ("IC / NSA Programs", "Multiple", "Fort Meade", 30),
        "aurora": ("NRO / Space Programs", "Multiple", "Buckley SFB", 30),
        "tucson": ("Raytheon Programs", "Raytheon", "Tucson Site", 30),
    }

    for loc_key, defaults in location_defaults.items():
        if loc_key in location:
            return defaults

    return "Unidentified", "Unknown", "Unknown", 0


def determine_task_order(location: str, program: str) -> str:
    """Determine task order/site from location and program."""
    location = location.lower()

    task_order_map = {
        # AF DCGS Sites
        ("dcgs", "langley"): "DGS-1 Langley",
        ("dcgs", "hampton"): "DGS-1 Langley",
        ("dcgs", "beale"): "DGS-2 Beale",
        ("dcgs", "wright"): "DGS Wright-Patt",
        ("dcgs", "dayton"): "DGS Wright-Patt",
        ("dcgs", "hickam"): "DGS PACAF Hickam",
        ("dcgs", "san diego"): "DGS PACAF",

        # MDA Sites
        ("mda", "huntsville"): "MDA Huntsville",
        ("mda", "colorado springs"): "MDA Colorado Springs",
        ("mda", "schriever"): "MDA Schriever",

        # Navy Sites
        ("navy", "norfolk"): "Norfolk Naval Base",
        ("navy", "san diego"): "SPAWAR / NIWC Pacific",
        ("navy", "chesapeake"): "NNSY",
    }

    program_lower = program.lower()
    for (prog_key, loc_key), task_order in task_order_map.items():
        if prog_key in program_lower and loc_key in location:
            return task_order

    return "Site TBD"


def match_contacts_to_job(job: Dict, contacts: List[Dict], mapped_program: str, location: str) -> List[Dict]:
    """Find contacts that match the job based on program, location, and role alignment."""
    matched = []

    job_location = location.lower()
    job_title_lower = (job.get("jobTitle", "") or "").lower()

    for contact in contacts:
        contact_program = (contact.get("Program", "") or "").lower()
        contact_location = (contact.get("Person City", "") or "").lower()
        contact_role = (contact.get("Job Title", "") or "").lower()

        # Program match
        program_match = False
        if mapped_program.lower() in contact_program or contact_program in mapped_program.lower():
            program_match = True
        elif "dcgs" in mapped_program.lower() and "dcgs" in contact_program:
            program_match = True

        # Location match
        location_match = False
        if contact_location:
            if contact_location in job_location or job_location.split(",")[0].strip() in contact_location:
                location_match = True

        # Role alignment (is contact in a position to help with hiring?)
        role_alignment = False
        hiring_roles = ["manager", "director", "lead", "supervisor", "pm ", "program manager"]
        if any(role in contact_role for role in hiring_roles):
            role_alignment = True

        # Score the match
        match_score = 0
        if program_match:
            match_score += 3
        if location_match:
            match_score += 2
        if role_alignment:
            match_score += 1

        if match_score >= 3:  # At least program match
            matched.append({
                **contact,
                "match_score": match_score,
                "match_type": "CONFIRMED" if match_score >= 4 else "LIKELY"
            })

    # Sort by score and return top matches
    matched.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    return matched[:5]


def generate_data_pull_request(job: Dict, mapped_program: str, prime: str, location: str) -> str:
    """Generate a specific data pull strategy when we don't have contacts."""
    job_title = job.get("jobTitle", "")
    clearance = extract_clearance(job)

    # Extract city and state
    loc_parts = location.split(",") if location else ["Unknown"]
    city = loc_parts[0].strip() if loc_parts else "Unknown"
    state = loc_parts[1].strip() if len(loc_parts) > 1 else ""

    # Determine search titles based on job role
    search_titles = []
    job_lower = job_title.lower()

    if "manager" in job_lower or "lead" in job_lower:
        search_titles = ["Program Manager", "Project Manager", "Engineering Manager", "Team Lead"]
    elif "engineer" in job_lower:
        search_titles = ["Engineering Manager", "Sr. Engineer", "Technical Lead", "Director of Engineering"]
    elif "admin" in job_lower or "administrator" in job_lower:
        search_titles = ["IT Manager", "Systems Manager", "Operations Manager", "Site Lead"]
    elif "analyst" in job_lower:
        search_titles = ["Analytics Manager", "Sr. Analyst", "Team Lead", "Department Manager"]
    else:
        search_titles = ["Program Manager", "Site Manager", "Operations Manager", "Department Lead"]

    # Build data pull request
    request = f"""DATA PULL REQUEST:

1. BULLHORN SEARCH:
   - Company: {prime}
   - Program Keywords: {mapped_program}
   - Location: {city}, {state}
   - Job Titles: {', '.join(search_titles)}
   - Clearance: {clearance}

2. ZOOMINFO SEARCH:
   - Current Employer: {prime}
   - Location: {city}, {state}
   - Titles: {', '.join(search_titles[:2])}
   - Filter: {clearance} clearance if available

3. LINKEDIN SEARCH:
   - Keywords: "{prime}" "{mapped_program}"
   - Location: {city} area
   - Connections: Check for PTS existing contacts

4. CUSTOMER INTEL:
   - Ask current {prime} contacts about {mapped_program} program managers in {city}
   - Check Notion for any {prime} contacts in {state}"""

    return request


# ============================================================================
# MAIN PARSER
# ============================================================================

def parse_job_opportunities():
    """Main function to parse job opportunities and generate comprehensive spreadsheet."""
    base_dir = os.path.dirname(os.path.dirname(__file__))

    # Load data
    print("=" * 60)
    print("LOADING DATA SOURCES")
    print("=" * 60)

    scrape_dir = os.path.join(base_dir, "Engine1_Scraper", "data")
    jobs = load_scrape_files(scrape_dir)
    print(f"Total jobs to process: {len(jobs)}")

    contacts_file = os.path.join(base_dir, "Engine3_OrgChart", "data", "DCGS_Contacts.csv")
    contacts = load_contacts(contacts_file)

    # Process each job
    print("\n" + "=" * 60)
    print("PROCESSING JOBS")
    print("=" * 60)

    processed_jobs = []

    for job in jobs:
        # Extract basic info
        job_title = job.get("jobTitle", "")
        location = job.get("location", "")
        clearance = extract_clearance(job)
        source = job.get("source", "")
        url = job.get("url", "")
        date_posted = job.get("datePosted", "")

        # Map to program
        program, prime, task_order, confidence = map_to_program(job)

        # Override prime if identifiable from description
        identified_prime = identify_prime(job)
        if identified_prime != "Unknown":
            prime = identified_prime

        # Match contacts
        matched_contacts = match_contacts_to_job(job, contacts, program, location)

        # Generate contact info or data pull request
        if matched_contacts:
            contact_names = "; ".join([
                f"{c.get('First Name', '')} {c.get('Name', '')} ({c.get('Job Title', '')[:30]})"
                for c in matched_contacts[:3]
            ])
            contact_emails = "; ".join([c.get("Email Address", "") for c in matched_contacts[:3] if c.get("Email Address")])
            contact_phones = "; ".join([c.get("Phone Number", "") for c in matched_contacts[:3] if c.get("Phone Number")])
            data_pull = ""
        else:
            contact_names = "NO CONTACTS - SEE DATA PULL REQUEST"
            contact_emails = ""
            contact_phones = ""
            data_pull = generate_data_pull_request(job, program, prime, location)

        processed_jobs.append({
            "Job Title": job_title,
            "Source": source,
            "Date Posted": date_posted,
            "Location": location,
            "Security Clearance": clearance,
            "Mapped Program": program,
            "Prime Contractor": prime,
            "Task Order / Site": task_order,
            "Mapping Confidence": f"{confidence}%",
            "Matched Contacts": contact_names,
            "Contact Emails": contact_emails,
            "Contact Phones": contact_phones,
            "Data Pull Request": data_pull,
            "Job URL": url,
            "BD Priority": "HIGH" if confidence >= 70 and clearance in ["TS/SCI", "TS/SCI w/ Poly", "Top Secret"] else "MEDIUM" if confidence >= 50 else "LOW"
        })

    # Sort by BD Priority and Confidence
    priority_order = {"HIGH": 0, "MEDIUM": 1, "LOW": 2}
    processed_jobs.sort(key=lambda x: (priority_order.get(x["BD Priority"], 3), -int(x["Mapping Confidence"].replace("%", ""))))

    # Generate output
    output_dir = os.path.join(base_dir, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"job_opportunities_{timestamp}.csv")

    # Write CSV
    headers = [
        "Job Title", "Source", "Date Posted", "Location", "Security Clearance",
        "Mapped Program", "Prime Contractor", "Task Order / Site", "Mapping Confidence",
        "Matched Contacts", "Contact Emails", "Contact Phones",
        "Data Pull Request", "Job URL", "BD Priority"
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()
        writer.writerows(processed_jobs)

    print(f"\n[OK] Job Opportunities CSV generated: {output_file}")
    print(f"Total jobs processed: {len(processed_jobs)}")

    # Summary statistics
    print("\n" + "=" * 60)
    print("SUMMARY STATISTICS")
    print("=" * 60)

    high_priority = len([j for j in processed_jobs if j["BD Priority"] == "HIGH"])
    medium_priority = len([j for j in processed_jobs if j["BD Priority"] == "MEDIUM"])
    low_priority = len([j for j in processed_jobs if j["BD Priority"] == "LOW"])

    with_contacts = len([j for j in processed_jobs if "NO CONTACTS" not in j["Matched Contacts"]])
    need_data_pull = len([j for j in processed_jobs if j["Data Pull Request"]])

    print(f"HIGH Priority: {high_priority}")
    print(f"MEDIUM Priority: {medium_priority}")
    print(f"LOW Priority: {low_priority}")
    print(f"\nJobs with Contacts: {with_contacts}")
    print(f"Jobs Needing Data Pull: {need_data_pull}")

    # Program breakdown
    programs = {}
    for j in processed_jobs:
        p = j["Mapped Program"]
        programs[p] = programs.get(p, 0) + 1

    print("\nTop Programs:")
    for p, count in sorted(programs.items(), key=lambda x: x[1], reverse=True)[:10]:
        print(f"  {p}: {count}")

    return output_file


if __name__ == "__main__":
    output_path = parse_job_opportunities()
    print(f"\nCSV file location: {output_path}")
