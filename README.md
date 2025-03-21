﻿# CAD Viewer
# GitHub Repository Troubleshooting Guide

If you're encountering issues with pushing to your GitHub repository, try these troubleshooting steps:

## Authentication Issues

1. Verify your GitHub credentials are working correctly:
   ```
   git config --global credential.helper
   ```
   You might need to update your credentials in Windows Credential Manager if you're using Windows.

2. Check if the repository exists on GitHub and that you have proper permissions:
   * Visit https://github.com/radhakrishna-ardhala/cad-viewer.git in your browser
   * Ensure you're logged in with the correct account
   * Verify you have write access to this repository

## Repository Issues

3. Try creating a simple test file to commit:
   ```
   echo "# Test" > test.md
   git add test.md
   git commit -m "Add test file"
   git push -u origin main
   ```

4. Check if you're behind a proxy or firewall that might be blocking Git operations.

5. Try using the GitHub CLI tool if available:
   ```
   gh auth login
   gh repo view
   ```

## Last Resort Options

6. As a last resort, you could delete your local repository and clone it fresh from GitHub (assuming there's already content there):
   ```
   cd ..
   rm -rf website
   git clone https://github.com/radhakrishna-ardhala/cad-viewer.git website
   cd website
   ```
