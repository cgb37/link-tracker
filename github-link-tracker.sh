#!/bin/bash

# GitHub repository details
GITHUB_OWNER="$GITHUB_OWNER"
GITHUB_REPO="$GITHUB_REPO"
SERVER_URL="${SERVER_URL:-http://localhost:3333}"

# Check if required environment variables are set
if [ -z "$GITHUB_OWNER" ]; then
    echo "Error: GITHUB_OWNER environment variable is not set"
    echo "Please define it in your .env file"
    exit 1
fi

if [ -z "$GITHUB_REPO" ]; then
    echo "Error: GITHUB_REPO environment variable is not set"
    echo "Please define it in your .env file"
    exit 1
fi


# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo "Error: jq is not installed. Please install it first:"
    echo "For Ubuntu/Debian: sudo apt-get install jq"
    echo "For MacOS: brew install jq"
    exit 1
fi

# Note: This CLI is server-only and requires the local web server to be running.
# It will POST to $SERVER_URL/api/bookmarks and use the server for label management.

# Function to create a new label
create_label() {
    local label="$1"
    local color="$(printf '%06x\n' $(($RANDOM % 16777215)))"  # Random color

    echo "Creating label '$label' via server $SERVER_URL..."
    response=$(curl -s --max-time 10 -S -f -X POST "$SERVER_URL/api/labels" \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"$label\",\"color\":\"$color\"}") || {
        echo "Error: Unable to reach server at $SERVER_URL. Make sure the web server is running." >&2
        return 1
    }

    if echo "$response" | jq -e .name > /dev/null; then
        echo "Label '$label' created successfully"
        return 0
    else
        echo "Error creating label (server response):"
        echo "$response" | jq '.'
        return 1
    fi
}

# Function to get existing labels
get_labels() {
    # Prefer the server endpoint which already implements pagination and caching
    response=$(curl -s --max-time 5 -S -f "$SERVER_URL/api/labels") || {
        echo "Error: Unable to reach server at $SERVER_URL. Start the server and try again." >&2
        return 1
    }

    # Output one label name per line
    echo "$response" | jq -r '.[].name'
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

# Create the bookmark via the local server
response=$(curl -s --max-time 10 -S -f -X POST "$SERVER_URL/api/bookmarks" \
    -H "Content-Type: application/json" \
    -d "$json_payload") || {
    echo -e "\nError: Unable to reach server at $SERVER_URL. Make sure the server is running and try again." >&2
    exit 1
}

# Check if bookmark was created successfully (server returns bookmark with id)
if echo "$response" | jq -e .id > /dev/null; then
    issue_number=$(echo "$response" | jq .id)
    echo -e "\nSuccess! Bookmark (issue) #$issue_number created"
    echo "View it at: https://github.com/$GITHUB_OWNER/$GITHUB_REPO/issues/$issue_number"
else
    echo -e "\nError creating bookmark:"
    echo "$response" | jq '.'
    exit 1
fi