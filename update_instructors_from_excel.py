import pandas as pd
import json
import re

def create_id(full_name):
    """Create a clean ID from the full name"""
    # Remove ALL titles comprehensively
    name = re.sub(r'^(Assoc\.\s*Prof\.\s*Dr\.|Assist\.\s*Prof\.\s*Dr\.|Prof\.\s*Dr\.|Dr\.)\s*', '', full_name)
    name = re.sub(r'\s*–.*$', '', name)  # Remove department info after dash
    name = name.strip()
    
    # Create ID: lowercase, replace spaces with underscore
    # Keep Turkish characters in ID for consistency with existing format
    id_str = name.lower().replace(' ', '_')
    # Remove dots
    id_str = id_str.replace('.', '')
    
    return id_str

def extract_name_only(full_name):
    """Extract only the name, removing title and department"""
    # Remove ALL titles comprehensively (same as create_id)
    name = re.sub(r'^(Assoc\.\s*Prof\.\s*Dr\.|Assist\.\s*Prof\.\s*Dr\.|Prof\.\s*Dr\.|Dr\.)\s*', '', full_name)
    
    # Extract department (after dash) for reference but don't store
    department_match = re.search(r'\s*–\s*(.+)$', name)
    department = department_match.group(1) if department_match else ""
    
    # Clean name (remove department part)
    name = re.sub(r'\s*–.*$', '', name).strip()
    
    return name, department

# Read Excel file
df = pd.read_excel('hoca_listesi.xlsx')

# Get the column name (first column)
col_name = df.columns[0]

# Create instructors list
instructors = []

for full_name in df[col_name]:
    full_name = str(full_name).strip()
    
    # Extract components (no title needed)
    name, department = extract_name_only(full_name)
    instructor_id = create_id(full_name)
    
    instructor = {
        "id": instructor_id,
        "name": name,
        "title": "",  # No titles in schedule
        "department": department
    }
    
    instructors.append(instructor)

# Create final JSON structure
output = {
    "instructors": instructors
}

# Write to JSON file
with open('data/instructors.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ Successfully updated instructors.json with {len(instructors)} instructors")
print("\nFirst 5 instructors:")
for i in range(min(5, len(instructors))):
    inst = instructors[i]
    print(f"  ID: {inst['id']} -> Name: {inst['name']}" + (f" – {inst['department']}" if inst['department'] else ""))
