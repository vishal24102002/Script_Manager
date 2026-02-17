import re
import pdfplumber
import pandas as pd
from pathlib import Path
import os

# === Configuration ===
OUTPUT_FILE = "sdg_metadata_extracted.xlsx"

# === Headers list - Fixed with partial matching support ===
header_variations = [
    ["0.c. Indicator (SDG_INDICATOR)", "0.c. Indicator"],
    ["0.d. Series (SDG_SERIES_DESCR)", "0.d. Series"],
    ["2.a. Definition and concepts (STAT_CONC_DEF)", "2.a. Definition and concepts"],
    ["4.c. Method of computation (DATA_COMP)", "4.c. Method of computation"],
    ["4.a. Rationale (RATIONALE)", "4.a. Rationale"],
    ["4.b. Comment and limitations (REC_USE_LIM)", "4.b. Comments and limitations (REC_USE_LIM)", "4.b. Comment and limitations", "4.b. Comments and limitations"],
    ["3.a. Data sources (SOURCE_TYPE)", "3.a. Data sources"],
    ["3.e. Data providers (DATA_SOURCE)", "Data providers (DATA_SOURCE)", "3.e. Data providers", "Data providers"],
    # Data availability - many possible formats
    ["5.b. Data availability (COVERAGE)", 
     "5. Data availability and disaggregation (COVERAGE)",
     "5. Data availability and disaggregation",
     "Data availability and disaggregation (COVERAGE)",
     "Data availability (COVERAGE)", 
     "Data availability",
     "5.b. Data availability"],
    # Treatment of missing values - FIXED to match partial header
    ["4.f. Treatment of missing values"],  # Will use partial matching
    ["4.g. Regional aggregations (REG_AGG)", "4.g. Regional aggregations"]
]

# === Column names for Excel output ===
column_names = [
    "Indicator",
    "Series",
    "IndicatorDefinition",
    "MethodOfComputation",
    "Overview",
    "CommentsAndLimitations",
    "DataCollectionForGlobalMonitoring",
    "ObtainingData",
    "DataAvailability",
    "TreatmentOfMissingValues",
    "RegionalAndGlobalEstimates"
]

def extract_text_from_pdf(pdf_path):
    """Extract text from PDF"""
    text = ""
    try:
        with pdfplumber.open(pdf_path) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
    except Exception as e:
        print(f"    Error: {e}")
        return ""
    return text

def remove_bullets(text):
    """Remove bullet points from text"""
    if not text:
        return text
    
    lines = text.split('\n')
    cleaned_lines = []
    
    for line in lines:
        # Remove bullet points (•, *, -, ‣, ◦, etc.) at the start of lines
        cleaned_line = re.sub(r'^[\s]*[•\*\-‣◦▪▫]\s*', '', line)
        cleaned_lines.append(cleaned_line)
    
    return '\n'.join(cleaned_lines)

def parse_series(series_text):
    """Parse series text into individual series entries"""
    if not series_text:
        return []
    
    series_list = []
    
    # Pattern 1: Match format like "Prevalence of minimum dietary diversity among children aged 6-23 months (MDD-C)"
    # This is: Description (CODE)
    pattern1 = r'([^\n]+\([A-Z_\-]+\))'
    
    # Pattern 2: Match format like "VC_DSR_AFFCT - Description [1.5.1, 11.5.1, 13.1.1]"
    # This is: CODE - Description [optional indicators]
    pattern2 = r'([A-Z_]+\s*-\s*[^\n]+(?:\[[^\]]+\])?)'
    
    # Try Pattern 1 first (Description (CODE))
    matches = re.findall(pattern1, series_text)
    
    if matches:
        for match in matches:
            # Clean up the match
            series_entry = match.strip()
            
            # Filter out section headers like "0.e. Metadata update (META_LAST_UPDATE)"
            # Pattern: starts with digit(s), dot, letter, dot
            if re.match(r'^\d+\.[a-z]\.\s+', series_entry, re.I):
                continue
            
            if series_entry:
                series_list.append(series_entry)
    else:
        # Try Pattern 2 (CODE - Description)
        matches = re.findall(pattern2, series_text)
        
        if matches:
            for match in matches:
                # Clean up the match
                series_entry = match.strip()
                
                # Filter out section headers
                if re.match(r'^\d+\.[a-z]\.\s+', series_entry, re.I):
                    continue
                
                if series_entry:
                    series_list.append(series_entry)
        else:
            # If no pattern match, check if it's not a section header before adding
            cleaned_text = series_text.strip()
            if cleaned_text and not re.match(r'^\d+\.[a-z]\.\s+', cleaned_text, re.I):
                series_list.append(cleaned_text)
    
    return series_list

def clean_treatment_content(content):
    """Clean and format Treatment of Missing Values content"""
    lines = content.split('\n')
    cleaned_lines = []
    current_section = None
    section_content = []
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # Skip codes in parentheses
        if re.match(r'^\([A-Z_]+\)$', line):
            continue
        
        # Remove bullet points (•, *, -, etc.)
        line = re.sub(r'^[•\*\-‣◦▪▫]\s*', '', line)
        
        # Check if this is a section header
        if line.startswith("At country level"):
            # Save previous section if exists
            if current_section and section_content:
                content_text = ' '.join(section_content)
                cleaned_lines.append(f"{current_section}: {content_text}")
            
            current_section = "At country level"
            section_content = []
            
        elif line.startswith("At regional and global levels") or line.startswith("At regional level"):
            # Save previous section if exists
            if current_section and section_content:
                content_text = ' '.join(section_content)
                cleaned_lines.append(f"{current_section}: {content_text}")
            
            current_section = "At regional and global levels"
            section_content = []
            
        else:
            # This is content for the current section
            if current_section:
                section_content.append(line)
            else:
                # No section header yet, just add the line
                cleaned_lines.append(line)
    
    # Don't forget the last section
    if current_section and section_content:
        content_text = ' '.join(section_content)
        cleaned_lines.append(f"{current_section}: {content_text}")
    
    return '\n'.join(cleaned_lines)

def clean_data_availability(content):
    """Clean and format Data Availability content"""
    lines = content.split('\n')
    cleaned_lines = []
    current_label = None
    
    for line in lines:
        line = line.strip()
        
        # Skip empty lines
        if not line:
            continue
        
        # STOP at section 6 or higher (Comparability, References, etc.)
        if re.match(r'^6\.\s+', line):
            break
        
        # Skip "Sources of discrepancies:" and everything after
        if line.startswith("Sources of discrepancies"):
            break
        
        # Skip "Last updated:" lines
        if line.startswith("Last updated"):
            break
        
        # Check if it's a year range (e.g., "2005-2023")
        if re.match(r'^\d{4}-\d{4}$', line):
            cleaned_lines.append(f"DataAvailability: {line}")
            current_label = "DataAvailability"
            continue
        
        # Check for label lines
        if line.endswith(":"):
            label = line[:-1]  # Remove the colon
            if label in ["Time series", "Disaggregation", "Data availability"]:
                current_label = label
                continue
        
        # If we have a current label, this line is the value
        if current_label:
            if current_label == "Data availability":
                # Special case: if we see year range under "Data availability:"
                if re.match(r'^\d{4}-\d{4}$', line):
                    cleaned_lines.append(f"DataAvailability: {line}")
                else:
                    cleaned_lines.append(f"{current_label}: {line}")
            else:
                cleaned_lines.append(f"{current_label}: {line}")
            current_label = None
    
    return '\n'.join(cleaned_lines)

def format_formula_content(content):
    """
    Format mathematical formulas to be human-readable.
    Preserve formulas as single expressions instead of breaking them up.
    """
    if not content:
        return content
    
    # Replace common patterns to make formulas more readable
    lines = content.split('\n')
    formatted_lines = []
    current_formula = []
    in_formula = False
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # Detect formula indicators (lines with =, mathematical symbols)
        # Common patterns: PR_AGi = E_AGI / P_AGI, or variables defined
        is_formula_line = bool(re.search(r'[=÷×∑∏∫]|[\w]+\s*=\s*[\w\d]', line))
        is_variable_def = bool(re.match(r'^[A-Z_]+[a-z]*\s*[=≡]\s*.+', line))
        is_where_clause = line.lower().startswith('where')
        is_single_var = bool(re.match(r'^[A-Za-z_]+\s*=', line))
        
        # Check if this looks like a broken formula piece (single letter or short variable)
        is_broken_piece = bool(re.match(r'^[A-Z]{1,5}$', line) or re.match(r'^[A-Z]{1,5}\s+[A-Z]{1,5}$', line))
        
        if is_formula_line or is_variable_def or is_single_var or is_broken_piece:
            # This is part of a formula
            current_formula.append(line)
            in_formula = True
        elif is_where_clause:
            # End current formula if any
            if current_formula:
                formula_text = ' '.join(current_formula)
                formatted_lines.append(formula_text)
                current_formula = []
            formatted_lines.append(line)
            in_formula = False
        elif in_formula and line and not line.endswith(':'):
            # Continue collecting formula parts
            current_formula.append(line)
        else:
            # End current formula if any
            if current_formula:
                formula_text = ' '.join(current_formula)
                formatted_lines.append(formula_text)
                current_formula = []
            
            # Add regular text line
            if line:
                formatted_lines.append(line)
            in_formula = False
    
    # Don't forget the last formula
    if current_formula:
        formula_text = ' '.join(current_formula)
        formatted_lines.append(formula_text)
    
    return '\n'.join(formatted_lines)

def extract_definition_section(text):
    """
    Extract Definition section with special handling for:
    1. "Last updated:" appearing before actual content
    2. Multiple paragraphs of definition
    3. Stopping at "Concepts:" or numbered subsections
    4. Remove "Definition:" label from the beginning
    """
    # Try to find "2.a. Definition and concepts" section
    patterns = [
        r'2\.a\.\s+Definition and concepts\s*(?:\(STAT_CONC_DEF\))?\s*\n',
        r'2\.a\.\s+Definition and concepts\s*\n'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            start_pos = match.end()
            
            # Extract everything until the next major section (3.a or later)
            remaining_text = text[start_pos:]
            
            # Find the end of this section (next numbered section like "3.a.")
            end_match = re.search(r'\n3\.[a-z]\.\s+', remaining_text)
            if end_match:
                section_content = remaining_text[:end_match.start()]
            else:
                section_content = remaining_text[:2000]  # Take reasonable chunk
            
            # Now parse the section content
            lines = section_content.split('\n')
            definition_lines = []
            in_definition = False
            found_concepts = False
            
            for line in lines:
                line = line.strip()
                
                # Skip empty lines at the beginning
                if not line and not in_definition:
                    continue
                
                # Skip "Last updated:" lines (comprehensive check - catches lastupdated, last updated, etc.)
                if re.search(r'last\s*updated', line, re.I):
                    continue
                
                # Skip lines that are just dates (e.g., "2025-04-23", "2023-12-15")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', line):
                    continue
                
                # STOP at "Concepts:" section - this is the key fix
                if line == "Concepts:" or line.startswith("Concepts:"):
                    found_concepts = True
                    break
                
                # Check for "Definition:" header - SKIP IT, don't include it
                if line == "Definition:" or line.startswith("Definition:"):
                    in_definition = True
                    continue  # Skip the label itself
                
                # If we haven't found "Definition:" header yet, check if this looks like definition content
                if not in_definition and line and not line.endswith(':'):
                    # This might be definition content without a header
                    in_definition = True
                
                # Stop conditions (in addition to Concepts)
                if in_definition:
                    # Stop at "The term" (usually starts Concepts section even without header)
                    if line.startswith("The term "):
                        break
                    
                    # Stop at numbered subsections like "1) Access to..."
                    if re.match(r'^\d+\)\s+[A-Z]', line):
                        break
                    
                    # Stop at other section headers that end with ":"
                    if line.endswith(':') and not line.startswith('Definition'):
                        # Check if it's likely a subsection header
                        if len(line.split()) <= 5:  # Short headers are likely subsection titles
                            break
                    
                    # Add the line if it's not empty
                    if line:
                        definition_lines.append(line)
            
            # Join the lines with newlines (will be replaced with spaces later)
            result = '\n'.join(definition_lines)
            return result.strip()
    
    return ""

def extract_series_section(text):
    """
    Extract Series section with special handling for:
    1. Full series descriptions like "Prevalence of minimum dietary diversity among children aged 6-23 months (MDD-C)"
    2. Multiple series if present
    3. Filter out section headers like "0.e. Metadata update" or "0.f. Related indicators"
    """
    # Try to find "0.d. Series" section
    patterns = [
        r'0\.d\.\s+Series\s*(?:\(SDG_SERIES_DESCR\))?\s*\n',
        r'0\.d\.\s+Series\s*\n'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            start_pos = match.end()
            
            # Extract everything until the next section
            # Look for 0.e, 0.f, 0.g, 1.a, 2.a, etc.
            remaining_text = text[start_pos:]
            
            # Find the end of this section - ANY numbered section that comes after
            # Pattern: newline followed by number, dot, letter, dot
            end_match = re.search(r'\n\d+\.[a-z]\.\s+', remaining_text, re.I)
            if end_match:
                section_content = remaining_text[:end_match.start()]
            else:
                section_content = remaining_text[:500]  # Take smaller chunk
            
            # Now parse the section content
            lines = section_content.split('\n')
            series_lines = []
            
            for line in lines:
                line = line.strip()
                
                # Skip empty lines
                if not line:
                    continue
                
                # Skip "Last updated:" lines (comprehensive check)
                if re.search(r'last\s+updated', line, re.I):
                    continue
                
                # Skip lines that are just dates (e.g., "2025-04-23")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', line):
                    continue
                
                # Skip section headers like "0.e. Metadata update" or "0.f. Related indicators"
                # Pattern: starts with digit(s), dot, letter, dot, space
                if re.match(r'^\d+\.[a-z]\.\s+', line, re.I):
                    continue
                
                # Skip lines that are section headers with long codes in parentheses
                # e.g., "Metadata update (META_LAST_UPDATE)" or "Related indicators (SDG_RELATED_INDICATORS)"
                if re.search(r'\([A-Z_]{10,}\)$', line):
                    continue
                
                # Skip organization names that appear without series context
                # These typically appear in 0.g section
                if re.search(r'^World Health Organization|^United Nations|^UNICEF|^UNESCO|^FAO\b', line, re.I):
                    continue
                
                # Add the line
                if line:
                    series_lines.append(line)
            
            # Join the lines with newlines
            result = '\n'.join(series_lines)
            
            # If result is empty or only contains section headers, return empty string
            if not result or not result.strip():
                return ""
            
            return result.strip()
    
    return ""

def extract_method_of_computation(text):
    """
    Extract Method of Computation section with special handling for:
    1. "Last updated:" appearing before actual content
    2. Mathematical formulas that should stay together
    3. Multiple paragraphs and references
    """
    # Try to find "4.c. Method of computation" section
    patterns = [
        r'4\.c\.\s+Method of\s*computation\s*(?:\(DATA_COMP\))?\s*\n',
        r'4\.c\.\s+Method of computation\s*\n'
    ]
    
    for pattern in patterns:
        match = re.search(pattern, text, re.I)
        if match:
            start_pos = match.end()
            
            # Extract everything until the next section (4.d or 4.e, etc.)
            remaining_text = text[start_pos:]
            
            # Find the end of this section
            end_match = re.search(r'\n4\.[d-z]\.\s+', remaining_text)
            if end_match:
                section_content = remaining_text[:end_match.start()]
            else:
                # Try to find section 5
                end_match = re.search(r'\n5\.[a-z]\.\s+', remaining_text)
                if end_match:
                    section_content = remaining_text[:end_match.start()]
                else:
                    section_content = remaining_text[:3000]  # Take reasonable chunk
            
            # Now parse the section content
            lines = section_content.split('\n')
            method_lines = []
            
            for line in lines:
                line = line.strip()
                
                # Skip empty lines at the beginning
                if not line and not method_lines:
                    continue
                
                # Skip "Last updated:" lines (comprehensive check)
                if re.search(r'last\s+updated', line, re.I):
                    continue
                
                # Skip lines that are just dates (e.g., "2025-04-23")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', line):
                    continue
                
                # Add the line
                if line:
                    method_lines.append(line)
            
            # Join the lines with newlines (will be replaced with spaces later)
            raw_content = '\n'.join(method_lines)
            
            # Apply formula formatting
            formatted_content = format_formula_content(raw_content)
            
            return formatted_content.strip()
    
    return ""

def extract_single_section(text, header_variations, col_name):
    """Extract a single section trying multiple header variations"""
    
    # Special handling for Definition section
    if col_name == "IndicatorDefinition":
        content = extract_definition_section(text)
        if content:
            return content
    
    # Special handling for Method of Computation section
    if col_name == "MethodOfComputation":
        content = extract_method_of_computation(text)
        if content:
            return content
    
    # Special handling for Series section
    if col_name == "Series":
        content = extract_series_section(text)
        if content:
            return content
    
    # Standard extraction for other sections
    for header in header_variations:
        # For "Treatment of missing values", use partial matching
        if "Treatment of missing values" in header:
            # Match any line starting with "4.f. Treatment of missing values"
            pattern = rf"4\.f\.\s+Treatment of missing values.*?\n(.*?)(?=\n4\.[a-z]\.\s+|\Z)"
            match = re.search(pattern, text, re.S | re.I)
        else:
            # Escape special regex characters in header
            start = re.escape(header)
            
            # Standard pattern
            pattern = rf"{start}\s*\n(.*?)(?=\n\d+\.[a-z]\.\s+|\Z)"
            match = re.search(pattern, text, re.S | re.I)
        
        if match:
            content = match.group(1).strip()
            
            # Special handling for "Data availability" section
            if "Data availability" in header or col_name == "DataAvailability":
                # Stop at section 6 (Comparability) or higher
                section_6_match = re.search(r'\n6\.\s+', content)
                if section_6_match:
                    content = content[:section_6_match.start()].strip()
                
                # Apply special cleaning for this section
                content = clean_data_availability(content)
                # Return immediately after cleaning
                if content and len(content.strip()) > 0:
                    return content
                else:
                    continue  # Try next header variation
            
            # Special handling for "Treatment of missing values" section
            elif "Treatment of missing values" in header or col_name == "TreatmentOfMissingValues":
                # Apply special cleaning for this section
                content = clean_treatment_content(content)
                # Return immediately after cleaning
                if content and len(content.strip()) > 0:
                    return content
                else:
                    continue  # Try next header variation
            
            # Clean up content line by line (for non-special sections)
            lines = content.split('\n')
            cleaned_lines = []
            
            for line in lines:
                line = line.strip()
                
                # Skip empty lines
                if not line:
                    continue
                
                # Skip lines that are just codes in parentheses
                if re.match(r'^\([A-Z_]+\)$', line):
                    continue
                
                # Skip "Last updated:" lines (comprehensive check - case insensitive)
                if re.search(r'last\s+updated', line, re.I):
                    continue
                
                # Skip lines that are just dates (e.g., "2025-04-23")
                if re.match(r'^\d{4}-\d{2}-\d{2}$', line):
                    continue
                
                cleaned_lines.append(line)
            
            # Join with newlines (will be replaced with spaces later)
            content = '\n'.join(cleaned_lines)
            
            # Return if we found meaningful content
            if content and len(content.strip()) > 0:
                return content
    
    # No match found with any variation
    return ""

def extract_sections(text, header_variations, column_names):
    """Extract all sections using header variations"""
    data = {}
    
    for i, headers in enumerate(header_variations):
        content = extract_single_section(text, headers, column_names[i])
        # Remove bullets from all sections
        content = remove_bullets(content)
        data[column_names[i]] = content
    
    return data

def process_single_pdf(pdf_path):
    """Process a single PDF file and return data (possibly multiple rows if multiple series)"""
    filename = Path(pdf_path).name
    print(f"  📄 {filename}")
    
    # Extract text from PDF
    text = extract_text_from_pdf(pdf_path)
    if not text:
        print(f"    ⚠ No text extracted")
        return None
    
    # Extract sections
    data = extract_sections(text, header_variations, column_names)
    
    # Parse series into individual entries
    series_text = data.get("Series", "")
    series_list = parse_series(series_text)
    
    if not series_list:
        # No series found, return single row with empty series
        data["PDF_File"] = filename
        sections_found = sum(1 for v in data.values() if v and v != filename)
        print(f"    ✓ Extracted {sections_found}/{len(header_variations)} sections (1 row)")
        return [data]
    
    # Multiple series - create multiple rows
    result_rows = []
    for series_entry in series_list:
        row_data = data.copy()
        row_data["Series"] = series_entry
        row_data["PDF_File"] = filename
        result_rows.append(row_data)
    
    sections_found = sum(1 for v in data.values() if v and v not in [filename, series_text])
    print(f"    ✓ Extracted {sections_found}/{len(header_variations)} sections ({len(series_list)} rows)")
    
    return result_rows

def main():
    """Main function to process all PDFs in folder"""
    print("=" * 70)
    print("SDG PDF METADATA EXTRACTOR - FINAL FIXED VERSION")
    print("=" * 70)
    print()
    
    # Get folder path from user
    folder_path = input("Enter the folder path containing PDF files: ").strip()
    folder_path = folder_path.strip('"').strip("'")
    
    # Check if folder exists
    if not os.path.exists(folder_path):
        print(f"\n❌ Error: Folder not found: {folder_path}")
        input("\nPress Enter to exit...")
        return
    
    # Get all PDF files
    pdf_files = list(Path(folder_path).glob("*.pdf"))
    
    if not pdf_files:
        print(f"\n❌ No PDF files found in: {folder_path}")
        input("\nPress Enter to exit...")
        return
    
    print(f"\n✓ Found {len(pdf_files)} PDF file(s)")
    print("\nProcessing PDFs...\n")
    
    # Process all PDFs
    all_data = []
    for i, pdf_file in enumerate(pdf_files, 1):
        print(f"[{i}/{len(pdf_files)}]")
        result = process_single_pdf(str(pdf_file))
        if result:
            # result is a list of rows (one or more)
            all_data.extend(result)
        
        # Show progress every 50 files
        if i % 50 == 0:
            print(f"\n  Progress: {i}/{len(pdf_files)} files processed\n")
    
    # Create DataFrame and save to Excel
    if all_data:
        # Create DataFrame
        df = pd.DataFrame(all_data)
        
        # Reorder columns to have PDF_File first
        cols = ["PDF_File"] + column_names
        df = df[cols]
        
        # Replace newlines with spaces in ALL columns (except PDF_File)
        print("\nCleaning newlines from all columns...")
        for col in column_names:  # Only clean the data columns, not PDF_File
            if col in df.columns:
                # Replace newlines with spaces and clean up multiple spaces
                df[col] = df[col].apply(lambda x: re.sub(r'\s+', ' ', re.sub(r'\n+', ' ', str(x))) if x else x)
                
                # Remove "Last updated" lines from all columns
                df[col] = df[col].apply(lambda x: re.sub(r'Last\s*updated:\s*\d{4}-\d{2}-\d{2}', '', str(x), flags=re.I) if x else x)
                df[col] = df[col].apply(lambda x: re.sub(r'Last\s*updated\s*\d{4}-\d{2}-\d{2}', '', str(x), flags=re.I) if x else x)
                # Clean up extra spaces after removal
                df[col] = df[col].apply(lambda x: re.sub(r'\s+', ' ', str(x)).strip() if x else x)
        
        # Remove bullet points from ALL columns
        print("Removing bullet points from all columns...")
        for col in column_names:
            if col in df.columns:
                # Remove bullets at the start of text (with optional leading spaces)
                df[col] = df[col].apply(lambda x: re.sub(r'^[\s]*[•\*\-‣◦▪▫●○■□▸▹]\s*', '', str(x)) if x else x)
                
                # Remove bullets from middle of text WITH spaces around them
                df[col] = df[col].apply(lambda x: re.sub(r'\s+[•\*\-‣◦▪▫●○■□▸▹]\s+', ' ', str(x)) if x else x)
                
                # Remove bullets embedded directly in text (no spaces) - replace with space
                df[col] = df[col].apply(lambda x: re.sub(r'[•\*‣◦▪▫●○■□▸▹]', ' ', str(x)) if x else x)
                
                # Clean up any multiple spaces created and trim
                df[col] = df[col].apply(lambda x: re.sub(r'\s+', ' ', str(x)).strip() if x else x)
        
        # Special cleaning for Series column - remove "Not applicable" and section headers
        print("Cleaning Series column...")
        if 'Series' in df.columns:
            df['Series'] = df['Series'].apply(lambda x: '' if (
                not x or 
                str(x).strip() == '' or 
                str(x).strip().lower() == 'not applicable' or
                re.match(r'^\d+\.[a-z]\.\s+', str(x), re.I) or  # Section headers like "0.e."
                re.search(r'\([A-Z_]{10,}\)$', str(x)) or  # Long codes like (META_LAST_UPDATE)
                re.search(r'^World Health Organization|^United Nations|^UNICEF|^UNESCO|^FAO\b|^\(WHO\)$|^\(UN\)$', str(x), re.I) or  # Organization names
                re.match(r'^\d{4}-\d{2}-\d{2}$', str(x))  # Dates
            ) else x)
        
        # Save to Excel
        output_path = os.path.join(folder_path, OUTPUT_FILE)
        
        try:
            # Save with formatting
            print("\nSaving to Excel file...")
            with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
                df.to_excel(writer, index=False, sheet_name='SDG Metadata')
                
                # Get the worksheet
                worksheet = writer.sheets['SDG Metadata']
                
                # Adjust column widths
                for idx, col in enumerate(df.columns, 1):
                    max_length = max(
                        df[col].astype(str).map(len).max(),
                        len(col)
                    )
                    adjusted_width = min(max_length + 2, 100)
                    # Get column letter
                    if idx <= 26:
                        column_letter = chr(64 + idx)
                    else:
                        column_letter = f"A{chr(64 + idx - 26)}"
                    worksheet.column_dimensions[column_letter].width = adjusted_width
                
                # Enable text wrapping
                from openpyxl.styles import Alignment
                for row in worksheet.iter_rows():
                    for cell in row:
                        cell.alignment = Alignment(wrap_text=True, vertical='top')
            
            print("=" * 70)
            print("✓ SUCCESS!")
            print("=" * 70)
            print(f"Total PDFs processed: {len(pdf_files)}")
            print(f"Total rows created: {len(all_data)}")
            print(f"Sections extracted: {len(header_variations)}")
            
            # Show extraction statistics
            extraction_stats = {}
            for col in column_names:
                count = sum(1 for row in all_data if row.get(col, ""))
                extraction_stats[col] = count
            
            print("\nExtraction Statistics:")
            for col, count in extraction_stats.items():
                percentage = (count / len(all_data)) * 100
                print(f"  {col:40} {count:3}/{len(all_data)} ({percentage:5.1f}%)")
            
            print(f"\nOutput file saved to:")
            print(f"  {output_path}")
            print("=" * 70)
            
        except Exception as e:
            print(f"❌ Error saving Excel file: {e}")
            import traceback
            traceback.print_exc()
    else:
        print("❌ No data extracted from any PDF files")
    
    input("\nPress Enter to exit...")

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\nProcess cancelled by user.")
    except Exception as e:
        print(f"\n❌ Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        input("\nPress Enter to exit...")