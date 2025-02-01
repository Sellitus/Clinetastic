import os
import re



replacements = [
    {
        "start_marker": "CAPABILITIES\n\n",
        "new_content": """
        Test 1
        """
    },
    {
        "start_marker": "USER'S CUSTOM INSTRUCTIONS\n\n",
        "new_content": """
        Test 2
        """
    },
    # Add more sections here if desired
]

def replace_section(text, start_marker, new_content):
    pattern = rf"({re.escape(start_marker)})(.*?)(?=(?:\n|\`|\')\s*:\s*\"\"|$)"
    return re.sub(pattern, rf"\1{new_content}", text, flags=re.DOTALL)

def patch_instructions(base_directory):
    
    if base_directory == "":
        base_directory = os.getcwd()
    
    for root, dirs, files in os.walk(base_directory):
        for filename in files:
            if filename.endswith(".ts"):
                filepath = os.path.join(root, filename)
                with open(filepath, "r", encoding="utf-8") as f:
                    original_text = f.read()

                new_text = original_text
                for rep in replacements:
                    new_text = replace_section(
                        new_text,
                        rep["start_marker"],
                        rep["new_content"],
                    )

                if new_text != original_text:
                    with open(filepath, "w", encoding="utf-8") as f:
                        f.write(new_text)
                    print(f"Patched: {filepath}")
    
def patch_name(base_directory):
    if base_directory == "":
        base_directory = os.getcwd()
    
    for root, dirs, files in os.walk(base_directory):
        for filename in files:
            filepath = os.path.join(root, filename)
            if os.path.isfile(filepath):
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = re.sub(r'(?i)roo-?code', lambda m: 'rootastic' if m.group().islower() else 'Rootastic', content)
                    
                    if new_content != content:
                        with open(filepath, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Renamed Rootastic references in: {filepath}")
                except UnicodeDecodeError:
                    # Skip binary files and files with non-UTF-8 encoding
                    continue
    

if __name__ == "__main__":
    # Adjust the path if necessary
    patch_dir = "src/core/prompts/sections"
    patch_instructions(patch_dir)
    patch_name("")
