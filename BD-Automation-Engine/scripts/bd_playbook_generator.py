#!/usr/bin/env python3
"""
BD Playbook Generator - Comprehensive Monday Call Sheet
Auto-matches CONFIRMED contacts to open jobs based on program, company, location, and task order.
Generates personalized BD pitches with PTS past performance and labor solutions.
"""

import csv
import json
import os
from datetime import datetime
import random

# ============================================================================
# PTS PAST PERFORMANCE AND CAPABILITIES
# ============================================================================

PTS_PAST_PERFORMANCE = {
    "network_engineering": {
        "title": "Network Engineering & Infrastructure",
        "description": "PTS has delivered cleared network engineers to GDIT programs including JUSTIFIED, CENTCOM/CITS, and DCGS supporting WAN/LAN administration, Cisco infrastructure, and enterprise network operations.",
        "key_placements": ["Network Administrator III - JUSTIFIED", "Sr. Network Engineer - CENTCOM/CITS", "Network Operations - DCGS"],
        "clearances": ["TS/SCI", "Secret"]
    },
    "cybersecurity": {
        "title": "Cybersecurity & RMF",
        "description": "PTS provides ISSOs, ISSMs, Security Engineers, and RMF specialists to DoD programs. Strong track record on GDIT ADCS, JUSTIFIED, and IC programs.",
        "key_placements": ["ISSO - ADCS", "Security Analyst - JUSTIFIED", "ISSE - DCGS"],
        "clearances": ["TS/SCI", "TS/SCI w/CI Poly", "Secret"]
    },
    "software_engineering": {
        "title": "Software Development & DevSecOps",
        "description": "PTS delivers cleared software engineers with experience in C/C++, Python, Java, and DevSecOps pipelines. Active placements on GDIT WARHAWK, Army programs, and MDA contracts.",
        "key_placements": ["Sr. Software Engineer - Army DEVCOM", "DevSecOps Engineer - MDA Programs"],
        "clearances": ["Secret", "TS/SCI"]
    },
    "systems_admin": {
        "title": "Systems Administration",
        "description": "PTS provides Windows and Linux system administrators with DoD 8570 certifications. Current placements on GDIT JUSTIFIED, CENTCOM/CITS, and DCGS programs.",
        "key_placements": ["Systems Administrator - JUSTIFIED", "Linux Admin - CENTCOM/CITS"],
        "clearances": ["Secret", "TS/SCI"]
    },
    "intelligence": {
        "title": "Intelligence & ISR Support",
        "description": "PTS supports SIGINT, GEOINT, and all-source intelligence positions across the IC and DoD. Active work with DCGS, INSCOM, and CENTCOM programs.",
        "key_placements": ["Intel Analyst - INSCOM", "ISR Support - DCGS"],
        "clearances": ["TS/SCI", "TS/SCI w/CI Poly"]
    },
    "field_service": {
        "title": "Field Service Engineering",
        "description": "PTS delivers field service engineers and technicians for deployed systems. Experience supporting GDIT DCGS sites, MDA programs, and tactical systems.",
        "key_placements": ["Field Service Engineer - DCGS PACAF", "FSE - MDA Ground Systems"],
        "clearances": ["Secret", "TS/SCI"]
    },
    "program_management": {
        "title": "Program & Project Management",
        "description": "PTS provides cleared program analysts and project managers with PMP certification and DoD acquisition experience.",
        "key_placements": ["Program Analyst - INSCOM", "Project Manager - WARHAWK"],
        "clearances": ["Secret", "TS/SCI"]
    }
}

# Map job titles to PTS capabilities
def get_pts_capability(job_title):
    job_lower = job_title.lower()
    if any(x in job_lower for x in ["network", "wan", "lan", "cisco", "router", "switch"]):
        return PTS_PAST_PERFORMANCE["network_engineering"]
    elif any(x in job_lower for x in ["security", "cyber", "isso", "issm", "isse", "rmf"]):
        return PTS_PAST_PERFORMANCE["cybersecurity"]
    elif any(x in job_lower for x in ["software", "developer", "devops", "devsecops", "engineer"]):
        return PTS_PAST_PERFORMANCE["software_engineering"]
    elif any(x in job_lower for x in ["system admin", "systems admin", "sysadmin", "linux admin", "windows admin"]):
        return PTS_PAST_PERFORMANCE["systems_admin"]
    elif any(x in job_lower for x in ["intel", "analyst", "sigint", "geoint", "isr"]):
        return PTS_PAST_PERFORMANCE["intelligence"]
    elif any(x in job_lower for x in ["field service", "fse", "technician", "fsr"]):
        return PTS_PAST_PERFORMANCE["field_service"]
    elif any(x in job_lower for x in ["program", "project", "manager"]):
        return PTS_PAST_PERFORMANCE["program_management"]
    else:
        return PTS_PAST_PERFORMANCE["software_engineering"]  # Default


# ============================================================================
# BD PITCH TEMPLATES
# ============================================================================

BD_PITCH_TEMPLATES = {
    "warm_intro": [
        "Hey {contact_name}, this is George with PTS - an approved GDIT supplier. I noticed you have openings for {job_title} on the {program} program. Our contractors have been getting calls from recruiters, and I wanted to reach out to see if we could support your team directly. {pts_pitch}",
        "Hi {contact_name}, George from PTS here. I saw the {job_title} position posted for {program} and wanted to connect. We're currently supporting similar roles on GDIT programs and have cleared candidates ready to interview. {pts_pitch}",
    ],
    "relationship_building": [
        "Hey {contact_name}, it's George with PTS. I'm working to build more traction within GDIT's {program} program. We're an approved supplier with past performance on similar GDIT contracts. I'd love to learn more about your current staffing challenges and how we might be able to help. {pts_pitch}",
        "Hi {contact_name}, George from PTS. I'm reaching out because we're actively supporting GDIT on several programs and looking to expand our partnership into {program}. Would you have 15 minutes to discuss any upcoming labor needs? {pts_pitch}",
    ],
    "direct_ask": [
        "Hey {contact_name}, George with PTS here. I see you're hiring {job_title} for the {program} task order at {location}. We have {clearance}-cleared candidates who match this exact profile. Can I send over a couple of resumes for your review? {pts_pitch}",
        "{contact_name}, it's George from PTS. Our team has been placing cleared talent on GDIT programs including JUSTIFIED and CENTCOM/CITS. I noticed the {job_title} opening on {program} and wanted to connect our recruiting team with yours. {pts_pitch}",
    ],
    "follow_up": [
        "Hi {contact_name}, following up on my earlier message. I wanted to see if you've had a chance to review the {job_title} candidates I mentioned. We have a strong pipeline of {clearance}-cleared talent ready to support {program}. {pts_pitch}",
        "Hey {contact_name}, checking in on the {program} staffing needs. Our team has successfully placed similar roles on other GDIT contracts and I believe we can help fill your {job_title} positions quickly. {pts_pitch}",
    ]
}

def generate_bd_pitch(contact, jobs, pitch_type="warm_intro"):
    """Generate a personalized BD pitch for a contact based on matched jobs."""
    templates = BD_PITCH_TEMPLATES.get(pitch_type, BD_PITCH_TEMPLATES["warm_intro"])
    template = random.choice(templates)

    # Get first job for main pitch
    job = jobs[0] if jobs else {}
    job_title = job.get("title", "the open positions")
    program = contact.get("program", job.get("program", "your program"))
    location = job.get("location", "your site")
    clearance = job.get("clearance", "cleared")

    # Get PTS capability for the job
    capability = get_pts_capability(job_title)
    pts_pitch = f"We have direct past performance in {capability['title']} with active placements on similar GDIT programs."

    pitch = template.format(
        contact_name=contact.get("name", "").split()[0] if contact.get("name") else "there",
        job_title=job_title,
        program=program,
        location=location,
        clearance=clearance,
        pts_pitch=pts_pitch
    )

    return pitch


# ============================================================================
# LABOR GAP SOLUTIONS
# ============================================================================

def get_labor_solution(job_title, contact_intel):
    """Generate labor gap solution based on job and contact intel."""
    job_lower = job_title.lower()
    intel_lower = (contact_intel or "").lower()

    solutions = []

    # Analyze job type
    if any(x in job_lower for x in ["network", "wan", "lan"]):
        solutions.append("PTS maintains a bench of CCNA/CCNP certified network engineers with active TS/SCI clearances.")
    if any(x in job_lower for x in ["cyber", "security", "isso"]):
        solutions.append("Our cybersecurity pipeline includes Security+ and CISSP certified professionals with RMF experience.")
    if any(x in job_lower for x in ["software", "developer"]):
        solutions.append("We have cleared software engineers proficient in C++, Python, Java, and DevSecOps pipelines.")
    if any(x in job_lower for x in ["system admin", "linux", "windows"]):
        solutions.append("PTS provides DoD 8570/8140 compliant system administrators with RHEL and Windows Server experience.")
    if any(x in job_lower for x in ["field service", "fse"]):
        solutions.append("Our FSE network includes technicians experienced with tactical systems and OCONUS deployments.")

    # Analyze contact intel for pain points
    if "attrition" in intel_lower or "retention" in intel_lower:
        solutions.append("We can provide CTH (contract-to-hire) placements to reduce your attrition risk.")
    if "cleared" in intel_lower or "clearance" in intel_lower:
        solutions.append("All PTS candidates are pre-screened with active clearances - no processing delays.")
    if "budget" in intel_lower or "cost" in intel_lower:
        solutions.append("PTS offers competitive rates as an approved small business supplier.")

    return " ".join(solutions[:3]) if solutions else "PTS has qualified cleared candidates ready to support your staffing needs."


# ============================================================================
# DATA LOADING
# ============================================================================

def load_program_mapped_jobs(filepath):
    """Load the program-mapped jobs from CSV."""
    jobs = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                jobs.append({
                    "title": row.get("Job Title", ""),
                    "priority": row.get("BD Priority", ""),
                    "score": row.get("BD Score", ""),
                    "clearance": row.get("Clearance", ""),
                    "confidence": row.get("Confidence", ""),
                    "dcgs_relevance": row.get("DCGS Relevance", ""),
                    "url": row.get("Job URL", ""),
                    "location": row.get("Location", ""),
                    "prime": row.get("Prime Contractor", ""),
                    "program": row.get("Program", ""),
                    "task_order": row.get("Task Order / Site", "")
                })
    except Exception as e:
        print(f"Error loading jobs: {e}")
    return jobs


def load_gdit_contacts(filepath):
    """Load GDIT PTS contacts from CSV."""
    contacts = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                contacts.append({
                    "name": row.get("Contact Name", ""),
                    "account_manager": row.get("Account Manager", ""),
                    "competitive_intel": row.get("Competitive Intel", ""),
                    "last_contact": row.get("Last Contact", ""),
                    "location": row.get("Location/Site", ""),
                    "next_action": row.get("Next Action", ""),
                    "opportunity_notes": row.get("Opportunity Notes", ""),
                    "priority": row.get("Priority", ""),
                    "program": row.get("Program", ""),
                    "raw_notes": row.get("Raw Notes", ""),
                    "role": row.get("Role/Title", ""),
                    "staffing_needs": row.get("Staffing Needs", ""),
                    "status": row.get("Status", ""),
                    "team_size": row.get("Team Size/FTE", "")
                })
    except Exception as e:
        print(f"Error loading contacts: {e}")
    return contacts


def load_dcgs_contacts(filepath):
    """Load DCGS contacts from CSV for AF DCGS matching."""
    contacts = []
    try:
        with open(filepath, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                # Only include AF DCGS contacts
                program = row.get("Program", "")
                if "AF DCGS" in program or "DCGS" in program:
                    # Column names: Name (last), First Name, Job Title, Email Address, Phone Number, Person City, Person State
                    first_name = row.get("First Name", "")
                    last_name = row.get("Name", "")  # First column is actually Last Name
                    contacts.append({
                        "name": f"{first_name} {last_name}".strip(),
                        "first_name": first_name,
                        "last_name": last_name,
                        "role": row.get("Job Title", ""),
                        "email": row.get("Email Address", ""),
                        "phone": row.get("Phone Number", "") or row.get("Mobile phone", ""),
                        "location": f"{row.get('Person City', '')}, {row.get('Person State', '')}",
                        "program": program,
                        "priority": row.get("BD Priority", ""),
                        "tier": row.get("Hierarchy Tier", ""),
                        "linkedin": row.get("LinkedIn Contact Profile URL", ""),
                        "functional_area": row.get("Functional Area", ""),
                        "location_hub": row.get("Location Hub", ""),
                        "raw_notes": f"DCGS Contact - {row.get('Hierarchy Tier', '')} - {row.get('Functional Area', '')}"
                    })
    except Exception as e:
        print(f"Error loading DCGS contacts: {e}")
    return contacts


# ============================================================================
# MATCHING LOGIC
# ============================================================================

def match_contacts_to_jobs(contacts, jobs):
    """Match contacts to relevant jobs based on program, location, and role."""
    matched = []

    for contact in contacts:
        contact_program = (contact.get("program") or "").lower()
        contact_location = (contact.get("location") or "").lower()
        contact_role = (contact.get("role") or "").lower()

        matched_jobs = []

        for job in jobs:
            job_program = (job.get("program") or "").lower()
            job_location = (job.get("location") or "").lower()
            job_prime = (job.get("prime") or "").lower()
            job_task_order = (job.get("task_order") or "").lower()

            # Match criteria - must have program or location match
            match_score = 0
            match_reasons = []

            # Program matching
            if contact_program and job_program:
                # Direct program match
                if contact_program in job_program or job_program in contact_program:
                    match_score += 3
                    match_reasons.append("Program match")
                # DCGS family matching
                elif "dcgs" in contact_program and "dcgs" in job_program:
                    match_score += 2
                    match_reasons.append("DCGS family")
                # Specific program matches
                elif "justified" in contact_program and "justified" in job_program:
                    match_score += 3
                    match_reasons.append("JUSTIFIED program")
                elif "centcom" in contact_program and "centcom" in job_program:
                    match_score += 3
                    match_reasons.append("CENTCOM program")
                elif "adcs" in contact_program and "adcs" in job_program:
                    match_score += 3
                    match_reasons.append("ADCS program")

            # Location matching
            if contact_location and job_location:
                contact_city = contact_location.split(",")[0].strip().lower()
                job_city = job_location.split(",")[0].strip().lower()
                if contact_city and job_city and (contact_city in job_city or job_city in contact_city):
                    match_score += 2
                    match_reasons.append("Location match")

            # Prime contractor matching (GDIT contacts should match GDIT jobs)
            if "gdit" in job_prime:
                match_score += 1
                match_reasons.append("GDIT prime")

            # Task order/site matching
            if contact_location and job_task_order:
                if any(loc in job_task_order.lower() for loc in contact_location.lower().split()):
                    match_score += 1
                    match_reasons.append("Task order site")

            if match_score >= 2:  # Minimum 2 match points
                matched_jobs.append({
                    **job,
                    "match_score": match_score,
                    "match_reasons": match_reasons
                })

        # Sort by match score and take top matches
        matched_jobs.sort(key=lambda x: x.get("match_score", 0), reverse=True)

        if matched_jobs:
            matched.append({
                "contact": contact,
                "jobs": matched_jobs[:5],  # Top 5 matches
                "best_match_score": matched_jobs[0].get("match_score", 0)
            })

    # Sort by best match score
    matched.sort(key=lambda x: x.get("best_match_score", 0), reverse=True)

    return matched


# ============================================================================
# MAIN GENERATOR
# ============================================================================

def generate_bd_playbook():
    """Generate the comprehensive BD playbook CSV."""
    base_dir = os.path.dirname(os.path.dirname(__file__))

    # Load data
    print("Loading program-mapped jobs...")
    jobs = load_program_mapped_jobs(
        os.path.join(base_dir, "Engine2_ProgramMapping", "data",
                     "Insight Global Jobs - Program Mapped (Dec 2025).csv")
    )
    print(f"  Loaded {len(jobs)} jobs")

    # Filter to high-value jobs (Critical, High, Medium priority)
    high_value_jobs = [j for j in jobs if j.get("priority") in ["🔥 Critical", "🟠 High", "🟡 Medium"]]
    print(f"  {len(high_value_jobs)} high-value jobs (Critical/High/Medium)")

    print("\nLoading GDIT PTS contacts...")
    gdit_contacts = load_gdit_contacts(
        os.path.join(base_dir, "Engine3_OrgChart", "data", "GDIT PTS Contacts.csv")
    )
    print(f"  Loaded {len(gdit_contacts)} GDIT contacts")

    print("\nLoading DCGS contacts...")
    dcgs_contacts = load_dcgs_contacts(
        os.path.join(base_dir, "Engine3_OrgChart", "data", "DCGS_Contacts.csv")
    )
    print(f"  Loaded {len(dcgs_contacts)} DCGS contacts")

    # Combine contacts
    all_contacts = gdit_contacts + dcgs_contacts
    print(f"\nTotal contacts: {len(all_contacts)}")

    # Match contacts to jobs
    print("\nMatching contacts to jobs...")
    matched = match_contacts_to_jobs(all_contacts, high_value_jobs)
    print(f"  Found {len(matched)} contacts with job matches")

    # Generate output
    output_dir = os.path.join(base_dir, "outputs")
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"bd_playbook_monday_{timestamp}.csv")

    # CSV headers
    headers = [
        "Contact Name",
        "Job Title/Role",
        "Company",
        "Program",
        "Location",
        "Contact Priority",
        "Account Manager",
        "Matched Open Jobs",
        "Job Clearances",
        "Job Locations",
        "Match Confidence",
        "BD Pitch (Personalized)",
        "PTS Past Performance",
        "Labor Gap Solution",
        "Staffing Intel",
        "Competitive Intel",
        "Next Action",
        "Contact Notes"
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=headers)
        writer.writeheader()

        for match in matched:
            contact = match["contact"]
            jobs = match["jobs"]

            # Get job details
            job_titles = "; ".join([j.get("title", "") for j in jobs[:3]])
            job_clearances = "; ".join(list(set([j.get("clearance", "") for j in jobs if j.get("clearance")])))
            job_locations = "; ".join(list(set([j.get("location", "") for j in jobs if j.get("location")])))

            # Generate BD pitch
            pitch = generate_bd_pitch(contact, jobs, pitch_type="warm_intro")

            # Get PTS capability
            first_job_title = jobs[0].get("title", "") if jobs else ""
            capability = get_pts_capability(first_job_title)
            pts_pp = f"{capability['title']}: {capability['description']}"

            # Get labor solution
            labor_solution = get_labor_solution(
                first_job_title,
                contact.get("raw_notes", "") + " " + contact.get("competitive_intel", "")
            )

            # Match confidence based on match score
            best_score = match.get("best_match_score", 0)
            if best_score >= 4:
                confidence = "HIGH - Confirmed Match"
            elif best_score >= 3:
                confidence = "MEDIUM - Strong Match"
            else:
                confidence = "MODERATE - Related"

            row = {
                "Contact Name": contact.get("name", ""),
                "Job Title/Role": contact.get("role", ""),
                "Company": "GDIT" if "gdit" in (contact.get("raw_notes", "") or "").lower() else "General Dynamics",
                "Program": contact.get("program", ""),
                "Location": contact.get("location", ""),
                "Contact Priority": contact.get("priority", ""),
                "Account Manager": contact.get("account_manager", ""),
                "Matched Open Jobs": job_titles,
                "Job Clearances": job_clearances,
                "Job Locations": job_locations,
                "Match Confidence": confidence,
                "BD Pitch (Personalized)": pitch,
                "PTS Past Performance": pts_pp,
                "Labor Gap Solution": labor_solution,
                "Staffing Intel": contact.get("staffing_needs", ""),
                "Competitive Intel": contact.get("competitive_intel", ""),
                "Next Action": contact.get("next_action", ""),
                "Contact Notes": contact.get("opportunity_notes", "") or contact.get("raw_notes", "")[:200]
            }
            writer.writerow(row)

    print(f"\n[OK] BD Playbook generated: {output_file}")
    print(f"   Total entries: {len(matched)}")

    # Summary statistics
    high_conf = len([m for m in matched if m.get("best_match_score", 0) >= 4])
    med_conf = len([m for m in matched if 3 <= m.get("best_match_score", 0) < 4])
    mod_conf = len([m for m in matched if m.get("best_match_score", 0) < 3])

    print(f"\nMatch Quality Summary:")
    print(f"   HIGH confidence: {high_conf}")
    print(f"   MEDIUM confidence: {med_conf}")
    print(f"   MODERATE confidence: {mod_conf}")

    return output_file


if __name__ == "__main__":
    output_path = generate_bd_playbook()
    print(f"\nCSV file location: {output_path}")
