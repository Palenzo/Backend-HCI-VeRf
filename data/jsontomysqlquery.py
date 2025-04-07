import json

# Load the JSON data
with open('E:\\ISL\\HCI-lab-data-validation-website\\server\\data\\videos.json', 'r') as file:
    videos = json.load(file)

# Prepare the SQL insert query
queries = []
for video in videos:
    query = f"('{video['id']}', '{video['path']}', '{video['correctSign']}')"
    queries.append(query)

# Combine all queries into a single SQL statement
sql_query = "INSERT INTO videos (id, path, correctSign) VALUES \n" + ",\n".join(queries) + ";"

# Output the SQL to a file
with open('videos.sql', 'w') as sql_file:
    sql_file.write(sql_query)

print("SQL queries have been written to videos.sql")
