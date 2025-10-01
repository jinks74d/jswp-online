# MCP (Model Context Protocol) Setup Guide

## What are MCPs?

MCPs extend Kiro's capabilities by connecting to external tools and services. They allow me to interact with databases, APIs, file systems, and more.

## Current Configuration

I've created an MCP configuration file at `.kiro/settings/mcp.json` with the following servers (all disabled by default):

### Available MCP Servers

#### 1. **Filesystem Server** 🗂️

- **Purpose**: Enhanced file operations beyond built-in tools
- **Capabilities**: Read, write, search files with advanced patterns
- **Auto-approved**: read_file, list_directory, write_file

#### 2. **Git Server** 🔄

- **Purpose**: Advanced Git operations and repository management
- **Capabilities**: Status, log, diff, branch operations
- **Auto-approved**: git_status, git_log, git_diff

#### 3. **SQLite Server** 🗃️

- **Purpose**: Local database operations
- **Capabilities**: Query SQLite databases, manage tables
- **Auto-approved**: query, list_tables

#### 4. **PostgreSQL Server** 🐘

- **Purpose**: Connect to your Supabase/PostgreSQL database
- **Capabilities**: Query, describe tables, manage data
- **Auto-approved**: query, list_tables, describe_table
- **Note**: Pre-configured for Supabase local development (port 54321)

#### 5. **Web Search Server** 🔍

- **Purpose**: Search the web for current information
- **Capabilities**: Brave Search API integration
- **Auto-approved**: search
- **Requires**: Brave Search API key

#### 6. **AWS Documentation Server** ☁️

- **Purpose**: Search AWS documentation
- **Capabilities**: Find AWS service docs, examples, best practices
- **Auto-approved**: search_docs

#### 7. **GitHub Server** 🐙

- **Purpose**: Interact with GitHub repositories
- **Capabilities**: Search repos, read files, manage issues
- **Auto-approved**: search_repositories, get_file_contents
- **Requires**: GitHub Personal Access Token

## Installation Steps

### Step 1: Install UV (Python Package Manager)

```powershell
# Option 1: Using pip
pip install uv

# Option 2: Using PowerShell (recommended)
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Option 3: Using Chocolatey (if you have it)
choco install uv
```

### Step 2: Verify Installation

```powershell
uv --version
uvx --version
```

### Step 3: Enable MCP Servers

Edit `.kiro/settings/mcp.json` and change `"disabled": true` to `"disabled": false` for the servers you want to use.

## Recommended Servers for Your Project

### For JSWP Online Development:

#### 1. **PostgreSQL Server** (Highest Priority)

```json
"postgres": {
  "disabled": false,
  "env": {
    "POSTGRES_CONNECTION_STRING": "postgresql://postgres:your_password@localhost:54321/postgres"
  }
}
```

**Benefits**: Direct database queries, schema inspection, data analysis

#### 2. **Git Server** (High Priority)

```json
"git": {
  "disabled": false
}
```

**Benefits**: Advanced Git operations, commit analysis, branch management

#### 3. **AWS Documentation Server** (Medium Priority)

```json
"aws-docs": {
  "disabled": false
}
```

**Benefits**: Quick access to AWS/Supabase documentation

## Configuration Examples

### PostgreSQL for Supabase

Update the connection string in your MCP config:

```json
"POSTGRES_CONNECTION_STRING": "postgresql://postgres:your_supabase_password@localhost:54321/postgres"
```

### Web Search (Optional)

1. Get a Brave Search API key from: https://api.search.brave.com/
2. Update the config:

```json
"BRAVE_API_KEY": "your_brave_api_key_here"
```

### GitHub Integration (Optional)

1. Create a GitHub Personal Access Token
2. Update the config:

```json
"GITHUB_PERSONAL_ACCESS_TOKEN": "your_github_token_here"
```

## Testing MCP Servers

After installation and configuration:

1. **Restart Kiro** to load the new MCP configuration
2. **Check MCP Server view** in the Kiro feature panel
3. **Test with simple commands**:
   - "Show me the database schema" (PostgreSQL)
   - "What's the git status?" (Git)
   - "Search AWS docs for RLS policies" (AWS Docs)

## Troubleshooting

### Common Issues:

1. **"uvx not found"**: Install UV first
2. **"Server connection failed"**: Check connection strings and credentials
3. **"Permission denied"**: Ensure auto-approve settings are correct

### Debug Commands:

```powershell
# Test UV installation
uvx --help

# Test MCP server directly
uvx mcp-server-git --help
```

## Next Steps

1. Install UV using one of the methods above
2. Choose which servers to enable based on your needs
3. Configure connection strings and API keys
4. Restart Kiro and test the servers

The PostgreSQL server would be particularly useful for your JSWP Online project since I could help you with database queries, schema analysis, and data management directly!
