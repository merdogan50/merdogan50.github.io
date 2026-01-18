import pandas as pd
import json
import re

# Read the instructor list from Excel
df = pd.read_excel('hoca_listesi.xlsx')

# Get the column name (it's the first column)
col_name = df.columns[0]

# Create instructors list
instructors = []

for idx, row in df.iterrows():
    full_name = str(row[col_name]).strip()
    
    # Skip empty rows
    if pd.isna(row[col_name]) or full_name == '':
        continue
    
    # Parse title and name
    # Patterns: "Prof. Dr. Name", "Assoc. Prof. Dr. Name", "Assist. Prof. Dr. Name", "Dr. Name – Department"
    title = ""
    name = full_name
    
    if full_name.startswith("Prof. Dr."):
        title = "Prof. Dr."
        name = full_name.replace("Prof. Dr.", "").strip()
    elif full_name.startswith("Assoc. Prof. Dr."):
        title = "Assoc. Prof. Dr."
        name = full_name.replace("Assoc. Prof. Dr.", "").strip()
    elif full_name.startswith("Assist. Prof. Dr."):
        title = "Assist. Prof. Dr."
        name = full_name.replace("Assist. Prof. Dr.", "").strip()
    elif full_name.startswith("Dr."):
        title = "Dr."
        # For Dr., remove the department part if exists (after –)
        name = full_name.replace("Dr.", "").strip()
        if "–" in name:
            name = name.split("–")[0].strip()
    
    # Create ID from name (lowercase, replace spaces and special chars with underscore)
    name_for_id = name.lower()
    name_for_id = re.sub(r'[^a-z0-9]+', '_', name_for_id)
    name_for_id = name_for_id.strip('_')
    
    instructor = {
        "id": name_for_id,
        "name": name,
        "title": title,
        "department": ""
    }
    
    instructors.append(instructor)

# Create the final JSON structure
output = {
    "instructors": instructors
}

# Write to file
with open('data/instructors.json', 'w', encoding='utf-8') as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"✅ Created instructors.json with {len(instructors)} instructors")
print("\nFirst 5 instructors:")
for i in instructors[:5]:
    print(f"  - {i['title']} {i['name']} (ID: {i['id']})")
