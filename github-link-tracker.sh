#!/bin/bash

# GitHub repository details
GITHUB_OWNER="cgb37"
GITHUB_REPO="link-tracker"
GITHUB_API="https://api.github.com"

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install it first:"
    echo "For Ubuntu/Debian: sudo apt-get install jq"
    echo "For MacOS: brew install jq"
    exit 1
fi

# Check if GitHub token is set
if [ -z "$GITHUB_TOKEN" ]; then
    echo "Error: GITHUB_TOKEN environment variable is not set"
    echo "Please create a personal access token at https://github.com/settings/tokens"
    echo "Then set it with: export GITHUB_TOKEN=your_token_here"
    exit 1
fi

# Function to create a new label
create_label() {
    local label="$1"
    local color="$(printf '%06x\n' $(($RANDOM % 16777215)))"  # Random color

    echo "Creating label '$label'..."
    response=$(curl -s -X POST "$GITHUB_API/repos/$GITHUB_OWNER/$GITHUB_REPO/labels" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$label\",\"color\":\"$color\"}")

    if echo "$response" | jq -e .name > /dev/null; then
        echo "Label '$label' created successfully"
        return 0
    else
        echo "Error creating label:"
        echo "$response" | jq '.'
        return 1
    fi
}

# Function to get existing labels
get_labels() {
    curl -s -X GET "$GITHUB_API/repos/$GITHUB_OWNER/$GITHUB_REPO/labels" \
        -H "Authorization: token $GITHUB_TOKEN" \
        -H "Accept: application/vnd.github.v3+json" | \
        jq -r '.[].name'
}

# Function to read user input
read_input() {
    local prompt="$1"
    local var_name="$2"
    local required="$3"
    local value

    while true; do
        read -r -p "$prompt" value
        if [ -n "$value" ] || [ "$required" != "required" ]; then
            # Use printf to properly handle special characters
            printf -v "$var_name" "%s" "$value"
            break
        else
            echo "This field is required. Please enter a value."
        fi
    done
}

# Get basic input
read_input "Enter title: " title "required"
read_input "Enter link: " link "required"
read_input "Enter description (optional): " description

# Handle label selection and creation
echo -e "\nExisting labels:"
# Store labels in an array using a while loop instead of mapfile
readarray -t labels < <(get_labels) || {
    # Fallback method if readarray is not available
    i=0
    while IFS= read -r line; do
        labels[i++]="$line"
    done < <(get_labels)
}

for i in "${!labels[@]}"; do
    echo "[$((i+1))] ${labels[$i]}"
done
echo "[0] Create new label"

selected_labels=()
while true; do
    echo -e "\nSelect labels (enter numbers separated by spaces, or 'done' when finished):"
    read -r selection

    if [ "$selection" = "done" ]; then
        break
    fi

    for num in $selection; do
        if [ "$num" = "0" ]; then
            read -p "Enter new label name(s) (separate multiple labels with commas): " new_labels
            IFS=',' read -ra label_array <<< "$new_labels"
            for new_label in "${label_array[@]}"; do
                # Trim whitespace from label
                new_label=$(echo "$new_label" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
                if [ -n "$new_label" ] && create_label "$new_label"; then
                    selected_labels+=("$new_label")
                fi
            done
        elif [ "$num" -ge 1 ] && [ "$num" -le "${#labels[@]}" ]; then
            label="${labels[$((num-1))]}"
            if [[ ! " ${selected_labels[@]} " =~ " ${label} " ]]; then
                selected_labels+=("$label")
                echo "Added: $label"
            else
                echo "Label already selected: $label"
            fi
        else
            echo "Invalid selection: $num"
        fi
    done

    echo -e "\nCurrently selected labels: ${selected_labels[*]}"
done

# Convert selected labels to JSON array
labels_json=$(printf '%s\n' "${selected_labels[@]}" | jq -R . | jq -s .)

# Format the issue body
BODY="Link: $link

Description: $description

Tags: ${selected_labels[*]}"

# Create JSON payload
json_payload=$(jq -n \
    --arg title "$title" \
    --arg body "$BODY" \
    --argjson labels "$labels_json" \
    '{
        title: $title,
        body: $body,
        labels: $labels
    }')

# Create the issue using GitHub API
response=$(curl -s -X POST "$GITHUB_API/repos/$GITHUB_OWNER/$GITHUB_REPO/issues" \
    -H "Authorization: token $GITHUB_TOKEN" \
    -H "Accept: application/vnd.github.v3+json" \
    -H "Content-Type: application/json" \
    -d "$json_payload")

# Check if issue was created successfully
if echo "$response" | jq -e .number > /dev/null; then
    issue_number=$(echo "$response" | jq .number)
    echo -e "\nSuccess! Issue #$issue_number created"
    echo "View it at: https://github.com/$GITHUB_OWNER/$GITHUB_REPO/issues/$issue_number"
else
    echo -e "\nError creating issue:"
    echo "$response" | jq '.'
fi