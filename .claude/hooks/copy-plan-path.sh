#!/bin/bash
# PostToolUse hook: Copy plan file path to clipboard when writing to .claude/tasks/

# Read JSON input from stdin
json_input=$(cat)

# Extract file path using jq
file_path=$(echo "$json_input" | jq -r '.tool_input.file_path // empty')

# Check if file is in .claude/tasks/ and is a markdown file
if [[ "$file_path" == *".claude/tasks/"* ]] && [[ "$file_path" == *.md ]]; then
  # Copy path to clipboard (macOS)
  echo -n "$file_path" | pbcopy
  echo "Copied to clipboard: $file_path"
fi

exit 0
