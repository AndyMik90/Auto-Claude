"""
Contact Lookup Engine - Retrieves relevant contacts for programs and prime contractors.
"""
import csv
from typing import Dict, List, Optional
from dataclasses import dataclass, field
from pathlib import Path

@dataclass
class Contact:
    name: str
    first_name: str = ""
    title: str = ""
    company: str = ""
    email: str = ""
    phone: str = ""
    linkedin: str = ""
    location: str = ""
    state: str = ""
    program: str = ""

@dataclass
class ContactLookupResult:
    program: str
    prime_contractor: str
    contacts: List[Contact] = field(default_factory=list)
    contact_count: int = 0
    lookup_method: str = ""

PRIORITY_TITLES = {
    "critical": ["program manager", "director", "vp", "vice president"],
    "high": ["senior manager", "technical lead", "principal"],
    "medium": ["recruiter", "manager", "lead"],
    "standard": ["engineer", "analyst", "specialist"]
}

class ContactDatabase:
    def __init__(self, data_dir=None):
        if data_dir is None:
            data_dir = Path(__file__).parent.parent / "data"
        self.data_dir = Path(data_dir)
        self.contacts = []
        self.by_program = {}
        self.by_company = {}
        self._load_contacts()

    def _load_contacts(self):
        files = ["DCGS_Contacts.csv", "GDIT PTS Contacts.csv", "GDIT_Other_Contacts.csv", "Lockheed Contact.csv"]
        for f in files:
            path = self.data_dir / f
            if path.exists():
                self._load_csv(path)
        self._build_indices()

    def _load_csv(self, filepath):
        try:
            with open(filepath, "r", encoding="utf-8-sig") as f:
                for row in csv.DictReader(f):
                    c = Contact(name=row.get("Name","").strip(), first_name=row.get("First Name","").strip(),
                        title=row.get("Job Title","").strip(), company=row.get("Company Name","").strip(),
                        email=row.get("Email Address","").strip(), phone=row.get("Phone Number",""),
                        linkedin=row.get("LinkedIn Contact Profile URL","").strip(),
                        location=row.get("Person City","").strip(), program=row.get("Program","").strip())
                    if c.name:
                        self.contacts.append(c)
        except Exception as e:
            print(f"Warning: {e}")

    def _build_indices(self):
        for c in self.contacts:
            if c.program:
                k = c.program.lower()
                self.by_program.setdefault(k, []).append(c)
            if c.company:
                k = c.company.lower()
                self.by_company.setdefault(k, []).append(c)

    @property
    def total_contacts(self):
        return len(self.contacts)

    def search_by_program(self, name):
        if not name: return []
        name = name.lower()
        r = list(self.by_program.get(name, []))
        for k,v in self.by_program.items():
            if name in k or k in name:
                r.extend([c for c in v if c not in r])
        return r

    def search_by_company(self, name):
        if not name: return []
        name = name.lower()
        r = []
        vars = [name]
        if "gdit" in name: vars.extend(["gdit", "general dynamics"])
        for v in vars:
            for k,cs in self.by_company.items():
                if v in k or k in v:
                    r.extend([c for c in cs if c not in r])
        return r

_db = None
def get_contact_database():
    global _db
    if _db is None:
        _db = ContactDatabase()
    return _db

def get_title_priority(title):
    if not title: return 5
    t = title.lower()
    for p in PRIORITY_TITLES["critical"]:
        if p in t: return 1
    for p in PRIORITY_TITLES["high"]:
        if p in t: return 2
    for p in PRIORITY_TITLES["medium"]:
        if p in t: return 3
    return 4

def rank_contacts(contacts, limit=5):
    scored = [(get_title_priority(c.title)*10 - (3 if c.email else 0), c) for c in contacts]
    scored.sort(key=lambda x: x[0])
    return [c for _,c in scored[:limit]]

def lookup_contacts(program_name=None, prime_contractor=None, location=None, limit=5):
    db = get_contact_database()
    all_c = []
    method = []
    if program_name:
        pc = db.search_by_program(program_name)
        all_c.extend(pc)
        if pc: method.append(f"program:{program_name}")
    if prime_contractor:
        cc = db.search_by_company(prime_contractor)
        all_c.extend([c for c in cc if c not in all_c])
        if cc: method.append(f"company:{prime_contractor}")
    ranked = rank_contacts(all_c, limit)
    return ContactLookupResult(program=program_name or "", prime_contractor=prime_contractor or "",
        contacts=ranked, contact_count=len(ranked), lookup_method=" | ".join(method) or "none")

def format_contacts_for_briefing(result):
    if not result.contacts:
        return "No contacts found."
    lines = []
    for c in result.contacts:
        name = f"{c.first_name} {c.name}".strip() or c.name
        line = f"**{name}** - {c.title}" if c.title else f"**{name}**"
        if c.company: line += f" at {c.company}"
        info = []
        if c.email: info.append(f"Email: {c.email}")
        if c.phone: info.append(f"Phone: {c.phone}")
        if c.linkedin: info.append(f"[LinkedIn]({c.linkedin})")
        if info: line += "\n  " + " | ".join(info)
        lines.append(line)
    return "\n".join(lines)

def format_contacts_json(result):
    return [{"name": f"{c.first_name} {c.name}".strip() or c.name, "title": c.title, "company": c.company,
             "email": c.email, "phone": c.phone, "linkedin": c.linkedin} for c in result.contacts]
