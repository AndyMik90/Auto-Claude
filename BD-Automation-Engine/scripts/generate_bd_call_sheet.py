#!/usr/bin/env python3
"""
BD Call Sheet Generator
Generates a CSV with AF DCGS contacts and simulated BD call notes for HUMINT gathering.
"""

import csv
import json
import os
from datetime import datetime
import random

# AF DCGS Contacts data (extracted from DCGS_Contacts.csv)
AF_DCGS_CONTACTS = [
    # Tier 1 - Executive / Critical
    {"first_name": "Michael", "last_name": "Bernard", "title": "Senior Director, Strategic Talent Programs", "email": "bernard@gdls.com", "phone": "(313) 407-1585", "program": "AF DCGS - PACAF", "tier": "Tier 1 - Executive", "priority": "Critical", "location": "San Diego, CA"},
    {"first_name": "Toi", "last_name": "Carden", "title": "Manager, Reconfigurable Combat Information Center & Instructor", "email": "carden@gdls.com", "phone": "(401) 218-9990", "program": "AF DCGS - PACAF", "tier": "Tier 1 - Executive", "priority": "Critical", "location": "Chula Vista, CA"},
    {"first_name": "Corey", "last_name": "Carter", "title": "Regional Program Director", "email": "mcarter@gdeb.com", "phone": "(757) 230-5146", "program": "AF DCGS - Langley", "tier": "Tier 1 - Executive", "priority": "Critical", "location": "Hampton, VA"},
    {"first_name": "Matthew", "last_name": "Pettinger", "title": "LCS Tactical Action Officer (TAO) & Instructor", "email": "matthew.pettinger@gdit.com", "phone": "(901) 299-2085", "program": "AF DCGS - PACAF", "tier": "Tier 1 - Executive", "priority": "Critical", "location": "San Diego, CA"},
    {"first_name": "Kerry", "last_name": "Taylor", "title": "Deputy Director, Strategic Development", "email": "kerry.taylor@gdit.com", "phone": "(937) 344-8731", "program": "AF DCGS - Wright-Patt", "tier": "Tier 1 - Executive", "priority": "Critical", "location": "Dayton, OH"},

    # Tier 3 - Program Leadership / High Priority
    {"first_name": "Taylor", "last_name": "Spencer", "title": "Program Manager & Cloud Developer & Manager", "email": "taylor.spencer2@csra.com", "phone": "(318) 210-6102", "program": "AF DCGS - Langley", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Hampton, VA"},
    {"first_name": "Rashaun", "last_name": "Albert", "title": "Program Manager", "email": "albert@gdls.com", "phone": "(757) 753-0858", "program": "AF DCGS - Langley", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Yorktown, VA"},
    {"first_name": "Brandon", "last_name": "Bishop", "title": "Site Lead Senior Training Specialist", "email": "brandon.bishop@gdit.com", "phone": "(310) 849-3451", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Bill", "last_name": "Bowers", "title": "Program Manager", "email": "walter.bowers@gd-ais.com", "phone": "(757) 203-7856", "program": "AF DCGS - Langley", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Yorktown, VA"},
    {"first_name": "John", "last_name": "Cerone", "title": "Senior Program Manager", "email": "john.cerone@gdit.com", "phone": "(757) 617-0128", "program": "AF DCGS - Langley", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Hampton, VA"},
    {"first_name": "Michael", "last_name": "Chagnon", "title": "Deputy Program Manager", "email": "michael.chagnon@gdit.com", "phone": "(401) 932-7202", "program": "AF DCGS - Langley", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Hampton, VA"},
    {"first_name": "David", "last_name": "Crawford", "title": "Senior Engineer & Program Manager", "email": "david.crawford@gdit.com", "phone": "(937) 623-7646", "program": "AF DCGS - Wright-Patt", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Dayton, OH"},
    {"first_name": "Paul", "last_name": "Cruz", "title": "Program Manager", "email": "paul.cruz@gd-ms.com", "phone": "(703) 434-2541", "program": "AF DCGS - Wright-Patt", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Dayton, OH"},
    {"first_name": "Matthew", "last_name": "Daly", "title": "Program Manager", "email": "matthew.daly@gd-ms.com", "phone": "(619) 260-0977", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Bradley", "last_name": "Greene", "title": "Senior Program Manager", "email": "brad.greene@gd-ms.com", "phone": "(480) 441-7709", "program": "AF DCGS - Wright-Patt", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Dayton, OH"},
    {"first_name": "Jennifer", "last_name": "Jaeger", "title": "Program Manager", "email": "jennifer.jaeger@gdit.com", "phone": "(619) 200-1661", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Kenneth", "last_name": "Landry", "title": "Program Manager, STRMS", "email": "kenneth.landry@gd-ms.com", "phone": "(619) 816-0200", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Chula Vista, CA"},
    {"first_name": "Craig", "last_name": "Lindahl", "title": "Senior Program Manager", "email": "craig.lindahl@gdit.com", "phone": "(937) 254-7950", "program": "AF DCGS - Wright-Patt", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "Dayton, OH"},
    {"first_name": "Matthew", "last_name": "Moore", "title": "Senior Program Manager", "email": "matthew.moore@gdit.com", "phone": "(831) 402-2843", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Robert", "last_name": "Santucci", "title": "Senior Program Manager", "email": "robert.santucci@gdit.com", "phone": "(760) 807-2610", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Douglas", "last_name": "Shamblen", "title": "Program Manager", "email": "dougs@gd.com", "phone": "(619) 553-7127", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},
    {"first_name": "Anthony", "last_name": "Stillwell", "title": "Program Manager", "email": "anthony.stillwell@csra.com", "phone": "(619) 524-3472", "program": "AF DCGS - PACAF", "tier": "Tier 3 - Program Leadership", "priority": "High", "location": "San Diego, CA"},

    # Tier 4 - Management / Medium Priority
    {"first_name": "Raquel", "last_name": "Adame", "title": "Manager, Security", "email": "raquel.adame@gdit.com", "phone": "(619) 621-0547", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Paul", "last_name": "Albert", "title": "Material Manager", "email": "paul.albert@gdit.com", "phone": "(619) 569-0787", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Chula Vista, CA"},
    {"first_name": "Tomasito", "last_name": "Alcantar", "title": "Project Manager, FF", "email": "tomasito.alcantar@generaldynamics.com", "phone": "", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Ron", "last_name": "Bilyj", "title": "Project Manager, Support ICIS", "email": "ron.bilyj@gdit.com", "phone": "(757) 451-7989", "program": "AF DCGS - Langley", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Hampton, VA"},
    {"first_name": "Gregory", "last_name": "Brackett", "title": "Project Manager", "email": "greg.brackett@gdit.com", "phone": "(937) 476-2158", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Dayton, OH"},
    {"first_name": "Douglas", "last_name": "Cabacungan", "title": "Project Manager", "email": "douglas.cabacungan@gdit.com", "phone": "(619) 920-7911", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Michael", "last_name": "Cordero", "title": "Shipyard Materials Manager", "email": "michael.cordero@gdit.com", "phone": "(510) 861-1667", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Chula Vista, CA"},
    {"first_name": "Bernard", "last_name": "Cramp", "title": "Senior Project Manager, Surface Ship Post Delivery Support", "email": "bernard.cramp@gd-ms.com", "phone": "(703) 263-7307", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Preston", "last_name": "Duarte", "title": "Manager, Materials", "email": "preston.duarte@gdit.com", "phone": "(202) 487-7951", "program": "AF DCGS - Langley", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Hampton, VA"},
    {"first_name": "Kristin", "last_name": "Ehricke", "title": "Manager, ISSO & Facilities", "email": "kristin.ehricke@gd-ms.com", "phone": "(858) 354-8636", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "El Cajon, CA"},
    {"first_name": "Jennifer", "last_name": "Francis", "title": "Project Manager, Economic & Analyst", "email": "jen.francis@csra.com", "phone": "", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Karla", "last_name": "Fuchs", "title": "Manager, DPOC Configuration", "email": "kfuchs@gdeb.com", "phone": "", "program": "AF DCGS - Langley", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Hampton, VA"},
    {"first_name": "Keith", "last_name": "Hogan", "title": "Manager, Project & Task", "email": "keith.hogan@gdit.com", "phone": "(757) 639-9495", "program": "AF DCGS - Langley", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Hampton, VA"},
    {"first_name": "Brayton", "last_name": "Jarvis", "title": "Project Manager, Information Technology", "email": "brayton.jarvis@gdit.com", "phone": "(270) 820-6855", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Dayton, OH"},
    {"first_name": "Anthony", "last_name": "Lans", "title": "Project Manager", "email": "anthony.lans@gdit.com", "phone": "(757) 235-1546", "program": "AF DCGS - Langley", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Hampton, VA"},
    {"first_name": "Deborah", "last_name": "Mcgraw", "title": "Supervisor, Program", "email": "deborah.mcgraw@gdit.com", "phone": "(937) 768-7478", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Beavercreek, OH"},
    {"first_name": "Lokesh", "last_name": "Mehra", "title": "Senior Project Manager, Information Technology", "email": "lokesh.mehra@gd-ms.com", "phone": "(858) 888-3310", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "San Diego, CA"},
    {"first_name": "Bob", "last_name": "Nolan", "title": "Manager, Configuration", "email": "bob.nolan@gdit.com", "phone": "(832) 494-5641", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Fairborn, OH"},
    {"first_name": "Alexis", "last_name": "Pace", "title": "Project Manager", "email": "alexis.pace@gd-ais.com", "phone": "(805) 750-0758", "program": "AF DCGS - PACAF", "tier": "Tier 4 - Management", "priority": "Medium", "location": "El Cajon, CA"},
    {"first_name": "E.", "last_name": "Reno", "title": "Network Engineering & Operations Site Manager", "email": "e..reno@gdit.com", "phone": "(937) 307-1137", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Dayton, OH"},
    {"first_name": "Susan", "last_name": "Servaites", "title": "Manager, Security", "email": "sservaites@generaldynamics.com", "phone": "(937) 476-2151", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Dayton, OH"},
    {"first_name": "Joel", "last_name": "Stammen", "title": "Project Manager", "email": "joel.stammen@gdit.com", "phone": "(937) 648-0417", "program": "AF DCGS - Wright-Patt", "tier": "Tier 4 - Management", "priority": "Medium", "location": "Dayton, OH"},

    # Tier 5 - Senior IC / Standard Priority
    {"first_name": "Margarita", "last_name": "Alvarez", "title": "FSO Senior Security Specialist", "email": "margarita.alvarez@gd-ms.com", "phone": "(619) 902-3056", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "San Diego, CA"},
    {"first_name": "Rodney", "last_name": "Bange", "title": "Senior Network Engineer", "email": "rodney.bange@gdit.com", "phone": "(937) 522-3756", "program": "AF DCGS - Wright-Patt", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Dayton, OH"},
    {"first_name": "Anthony", "last_name": "Bradshaw", "title": "Senior Network Engineer", "email": "anthony.bradshaw@csra.com", "phone": "(757) 230-9268", "program": "AF DCGS - Langley", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Hampton, VA"},
    {"first_name": "Tesa", "last_name": "Burke", "title": "Senior Security Specialist", "email": "tesa.burke@gdit.com", "phone": "(937) 476-2152", "program": "AF DCGS - Wright-Patt", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Dayton, OH"},
    {"first_name": "Jeffery", "last_name": "Clay", "title": "Senior Program Security Representative", "email": "jeffery.clay@gdit.com", "phone": "", "program": "AF DCGS - Wright-Patt", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Dayton, OH"},
    {"first_name": "Sergio", "last_name": "Contreras", "title": "IT End User Senior Technician", "email": "sergio.contreras@gd-ms.com", "phone": "(619) 559-4834", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Chula Vista, CA"},
    {"first_name": "Michelle", "last_name": "Hohauser", "title": "Senior Security Analyst", "email": "michelle.hohauser@csra.com", "phone": "(619) 535-3016", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "San Diego, CA"},
    {"first_name": "Kennedy", "last_name": "Kile", "title": "Senior Advanced Supply Chain Specialist", "email": "kennedy.kile@gd-ms.com", "phone": "(480) 441-1930", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "San Diego, CA"},
    {"first_name": "Shena", "last_name": "Markle", "title": "Senior Program Analyst", "email": "markle@gdls.com", "phone": "(757) 284-0850", "program": "AF DCGS - Langley", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Hampton, VA"},
    {"first_name": "Kamron", "last_name": "McIntyre", "title": "Information Security Analyst", "email": "kamron.mcintyre@gdit.com", "phone": "(912) 322-0898", "program": "AF DCGS - Wright-Patt", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Dayton, OH"},
    {"first_name": "Harold", "last_name": "Richard", "title": "Senior Field Service Technician", "email": "harold.richard@gdit.com", "phone": "(619) 947-1908", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "San Diego, CA"},
    {"first_name": "Israel", "last_name": "Ruiz", "title": "Senior Advanced Supply Chain Specialist", "email": "israel.ruiz@gd-ms.com", "phone": "(619) 823-3709", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "San Diego, CA"},
    {"first_name": "Christopher", "last_name": "Stackhouse", "title": "Senior Network Engineer", "email": "christopher.stackhouse@gdit.com", "phone": "(757) 291-0925", "program": "AF DCGS - Langley", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Hampton, VA"},
    {"first_name": "Don", "last_name": "Steffen", "title": "Senior Network Administrator", "email": "don_steffen@sra.com", "phone": "(619) 913-1187", "program": "AF DCGS - PACAF", "tier": "Tier 5 - Senior IC", "priority": "Standard", "location": "Chula Vista, CA"},
]

# Direct DCGS Open Jobs
DCGS_OPEN_JOBS = [
    {"title": "TS/SCI High Band System Software Support Engineer", "location": "Beale AFB, CA", "program": "AF DCGS (548th ISR Group)", "clearance": "TS/SCI", "priority": "Critical", "site": "DGS-2"},
    {"title": "TS/SCI Field Service Engineer", "location": "San Diego, CA", "program": "AF DCGS PACAF / Navy DCGS-N", "clearance": "TS/SCI", "priority": "Critical", "site": "PACAF Node"},
    {"title": "TS/SCI Payloads Field Service Engineer (Florida)", "location": "San Diego, CA", "program": "AF DCGS PACAF / Navy DCGS-N", "clearance": "TS/SCI", "priority": "Critical", "site": "PACAF Node"},
    {"title": "TS/SCI Low Band System Software Support Engineer", "location": "Hampton, VA", "program": "AF DCGS (480th ISR Wing)", "clearance": "TS/SCI", "priority": "Critical", "site": "DGS-1 Langley AFB"},
    {"title": "TS/SCI Low Band System Software Support Engineer", "location": "Beale AFB, CA", "program": "AF DCGS (548th ISR Group)", "clearance": "TS/SCI", "priority": "Critical", "site": "DGS-2"},
    {"title": "TS/SCI Systems Administrator", "location": "Dayton, OH", "program": "AF DCGS / NASIC Support", "clearance": "TS/SCI", "priority": "Critical", "site": "Wright-Patterson AFB"},
    {"title": "Top Secret Senior Safety Engineer", "location": "San Diego, CA", "program": "AF DCGS PACAF / Navy DCGS-N", "clearance": "Top Secret", "priority": "High", "site": "PACAF Node"},
    {"title": "Secret cleared Cloud Engineer", "location": "North Charleston, SC", "program": "Navy DCGS-N / NIWC Atlantic", "clearance": "Secret", "priority": "High", "site": "NIWC Engineering"},
    {"title": "Sr Software Engineer - Secret", "location": "Kettering, OH", "program": "AF DCGS / NASIC Support", "clearance": "Secret", "priority": "High", "site": "Wright-Patterson AFB"},
    {"title": "Secret Cleared Technical Writer", "location": "San Diego, CA", "program": "AF DCGS PACAF / Navy DCGS-N", "clearance": "Secret", "priority": "Medium", "site": "PACAF Node"},
    {"title": "Systems Administrator", "location": "San Diego, CA", "program": "AF DCGS PACAF / Navy DCGS-N", "clearance": "Unknown", "priority": "Medium", "site": "PACAF Node"},
    {"title": "Technical Lead Engineering System", "location": "Norfolk, VA", "program": "Navy DCGS-N", "clearance": "Unknown", "priority": "Medium", "site": "Fleet Intel Operations"},
]

# HUMINT call note templates
HUMINT_TEMPLATES = {
    "Critical": [
        "Connected with {name} ({title}). Key intel gathered: Currently leading team of {team_size} across {program}. Reports directly to {reports_to}. Mentioned upcoming {initiative} initiative requiring {skill_need}. Pain point: {pain_point}. Labor gap: {labor_gap}. Referral: Suggested connecting with {referral} for additional opportunities. Follow-up scheduled for {follow_up}.",
        "Spoke with {name}, {title} at {program}. Org structure: {team_size} FTEs, {contractors} contractors on task order. Reports to {reports_to}. Current priorities include {initiative}. Identified gap in {labor_gap}. {name} mentioned {pain_point} as major challenge. Warm intro offered to {referral}. Meeting set for {follow_up}.",
    ],
    "High": [
        "Call with {name} - {title} on {program}. Team size: {team_size} total ({contractors} contractors). Reporting chain: {reports_to}. Discussed {initiative} - they need {skill_need}. Labor shortages in {labor_gap}. Key pain point: {pain_point}. Potential referral to {referral}. Next steps: {follow_up}.",
        "Connected with {name} at {program}. Role: {title}, managing {team_size} staff. Current focus: {initiative}. Identified need for {skill_need}. They mentioned challenges with {pain_point}. Gap areas: {labor_gap}. {name} suggested talking to {referral}. Will follow up {follow_up}.",
    ],
    "Medium": [
        "Brief call with {name}, {title}. Works on {program} with team of {team_size}. Mentioned {initiative} as current priority. Skills needed: {skill_need}. Some concerns about {pain_point}. Potential intro to {referral} pending. Follow-up: {follow_up}.",
        "Spoke to {name} ({title}) about {program}. Team has {team_size} members, mix of FTEs/contractors. Current project: {initiative}. Looking for {skill_need}. Challenge area: {labor_gap}. Will reconnect {follow_up}.",
    ],
    "Standard": [
        "Initial contact with {name}, {title} at {program}. Gathered basic org info. Team size ~{team_size}. Working on {initiative}. May need {skill_need} support. Will follow up {follow_up}.",
        "Intro call with {name}. Role: {title} on {program}. {team_size} person team. Mentioned interest in {skill_need}. Scheduling follow-up for {follow_up}.",
    ]
}

# Data for generating realistic call notes
TEAM_SIZES = ["8-10", "12-15", "15-20", "20-25", "25-30", "30+", "40+", "50+"]
CONTRACTOR_RATIOS = ["60% contractors", "70% contractors", "75% contractors", "80% contractors"]
REPORTS_TO = ["Division Director", "VP of Programs", "Site Lead", "Program Director", "Deputy PM", "Operations Director", "Engineering Director"]
INITIATIVES = [
    "DGS Block 5 modernization", "cloud migration to C2E", "SIGINT capability upgrade",
    "DevSecOps transformation", "AI/ML integration", "network infrastructure refresh",
    "cybersecurity hardening", "system integration testing", "platform sustainment",
    "sensor integration", "data analytics expansion", "C2 modernization"
]
SKILL_NEEDS = [
    "cleared software engineers", "TS/SCI network admins", "cybersecurity specialists",
    "SIGINT analysts", "cloud architects", "DevSecOps engineers", "systems integrators",
    "RF engineers", "data scientists", "mission system SMEs", "full-stack developers"
]
PAIN_POINTS = [
    "difficulty finding cleared candidates locally", "attrition to higher-paying programs",
    "timeline pressure from customer", "budget constraints on new hires",
    "skills gap in cloud technologies", "security clearance processing delays",
    "retention of senior engineers", "competition from primes for talent"
]
LABOR_GAPS = [
    "mid-level software engineers", "senior network engineers", "cyber operators",
    "cloud architects", "systems administrators", "technical writers", "program analysts",
    "ISSO/ISSM roles", "integration testers", "DevSecOps specialists"
]
REFERRALS = [
    "their counterpart at DGS-1", "the NASIC program lead", "Navy DCGS-N PM",
    "their staffing coordinator", "the capture manager", "subcontract administrator",
    "HR partner for cleared roles", "another PM on the task order"
]
FOLLOW_UPS = ["next week", "in two weeks", "end of month", "early February", "after their RFP deadline", "post-holiday"]


def generate_call_notes(contact):
    """Generate realistic HUMINT-style BD call notes for a contact."""
    priority = contact.get("priority", "Standard")
    templates = HUMINT_TEMPLATES.get(priority, HUMINT_TEMPLATES["Standard"])
    template = random.choice(templates)

    return template.format(
        name=f"{contact['first_name']} {contact['last_name']}",
        title=contact["title"],
        program=contact["program"],
        team_size=random.choice(TEAM_SIZES),
        contractors=random.choice(CONTRACTOR_RATIOS),
        reports_to=random.choice(REPORTS_TO),
        initiative=random.choice(INITIATIVES),
        skill_need=random.choice(SKILL_NEEDS),
        pain_point=random.choice(PAIN_POINTS),
        labor_gap=random.choice(LABOR_GAPS),
        referral=random.choice(REFERRALS),
        follow_up=random.choice(FOLLOW_UPS)
    )


def get_related_jobs(contact):
    """Get open jobs related to the contact's program and location."""
    related = []
    contact_program = contact["program"].lower()
    contact_location = contact["location"].lower()

    for job in DCGS_OPEN_JOBS:
        job_program = job["program"].lower()
        job_location = job["location"].lower()

        # Match by program or location
        if ("pacaf" in contact_program and "pacaf" in job_program) or \
           ("langley" in contact_program and ("langley" in job_location or "hampton" in job_location)) or \
           ("wright-patt" in contact_program and ("dayton" in job_location or "wright" in job_program or "kettering" in job_location)) or \
           (contact_location.split(",")[0].lower() in job_location.lower()):
            related.append(f"{job['title']} ({job['location']})")

    return "; ".join(related[:3]) if related else "No direct job match - potential future opportunities"


def generate_bd_call_sheet():
    """Generate the BD call sheet CSV."""
    output_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "outputs")
    os.makedirs(output_dir, exist_ok=True)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_file = os.path.join(output_dir, f"bd_call_sheet_{timestamp}.csv")

    # CSV headers as requested
    headers = [
        "First Name",
        "Last Name",
        "Job Title",
        "Phone Number",
        "Email",
        "Program",
        "Open Jobs Connected To",
        "BD Call Notes (HUMINT)"
    ]

    with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=headers)
        writer.writeheader()

        for contact in AF_DCGS_CONTACTS:
            row = {
                "First Name": contact["first_name"],
                "Last Name": contact["last_name"],
                "Job Title": contact["title"],
                "Phone Number": contact["phone"],
                "Email": contact["email"],
                "Program": contact["program"],
                "Open Jobs Connected To": get_related_jobs(contact),
                "BD Call Notes (HUMINT)": generate_call_notes(contact)
            }
            writer.writerow(row)

    print(f"BD Call Sheet generated: {output_file}")
    print(f"Total contacts: {len(AF_DCGS_CONTACTS)}")

    # Count by priority
    priorities = {}
    for c in AF_DCGS_CONTACTS:
        p = c.get("priority", "Standard")
        priorities[p] = priorities.get(p, 0) + 1

    print("\nBreakdown by BD Priority:")
    for p, count in sorted(priorities.items()):
        print(f"  {p}: {count}")

    return output_file


if __name__ == "__main__":
    output_path = generate_bd_call_sheet()
    print(f"\nCSV file location: {output_path}")
