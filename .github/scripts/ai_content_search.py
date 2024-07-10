import requests
from bs4 import BeautifulSoup
import re

def search_ai_content():
    url = "https://news.google.com/search?q=artificial%20intelligence%20when:1d&hl=en-US&gl=US&ceid=US:en"
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = soup.find_all('article', class_='MQsxIb')

    results = []
    for article in articles[:5]:  # Get top 5 results
        title = article.find('h3', class_='ipQwMb').text
        link = "https://news.google.com" + article.find('a', class_='VDXfz')['href'][1:]
        results.append(f"- [{title}]({link})")

    return "\n".join(results)

def update_readme(content):
    with open('README.md', 'r') as file:
        readme = file.read()

    start_marker = "<!-- AI-CONTENT-LIST:START -->"
    end_marker = "<!-- AI-CONTENT-LIST:END -->"

    pattern = f"{start_marker}.*?{end_marker}"
    replacement = f"{start_marker}\n## Latest AI News\n{content}\n{end_marker}"
    
    updated_readme = re.sub(pattern, replacement, readme, flags=re.DOTALL)

    with open('README.md', 'w') as file:
        file.write(updated_readme)

if __name__ == "__main__":
    ai_content = search_ai_content()
    update_readme(ai_content)