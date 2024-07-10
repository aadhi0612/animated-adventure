# .github/scripts/ai_content_search.py
import sys
import requests
from bs4 import BeautifulSoup
import os 

def fetch_google_news(topic):
    url = f'https://news.google.com/search?q={topic}&hl=en-US&gl=US&ceid=US:en'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for item in soup.find_all('h3', limit=5):  # Limit to top 5 articles
        article = {
            'title': item.text,
            'link': 'https://news.google.com' + item.find('a', href=True)['href'][1:]
        }
        articles.append(article)
    return articles

def fetch_medium(tag):
    url = f'https://medium.com/tag/{tag}/latest'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for item in soup.find_all('h3', limit=5):  # Limit to top 5 articles
        try:
            link = item.parent['href']
        except KeyError:
            continue
        article = {
            'title': item.text,
            'link': f'https://medium.com{link}'
        }
        articles.append(article)
    return articles

def update_readme(articles):
    try:
        readme_path = 'README.md'
        if not os.path.exists(readme_path):
            print(f"Error: {readme_path} does not exist", file=sys.stderr)
            return

        with open(readme_path, 'r+') as file:
            content = file.read()
            start = content.find('<!-- AI-CONTENT-LIST:START -->') + 30
            end = content.find('<!-- AI-CONTENT-LIST:END -->')
            
            if start == -1 or end == -1:
                print("Error: Could not find AI-CONTENT-LIST markers in README.md", file=sys.stderr)
                return

            article_list = '\n'.join(f'- [{article["title"]}]({article["link"]})' for article in articles)
            updated_content = content[:start] + '\n' + article_list + '\n' + content[end:]
            
            file.seek(0)
            file.write(updated_content)
            file.truncate()
            
        print("README.md updated successfully")
    except Exception as e:
        print(f"Error updating README.md: {str(e)}", file=sys.stderr)

if __name__ == "__main__":
    if len(sys.argv) < 3:
        print("Usage: python script.py <topic> <tag>", file=sys.stderr)
        sys.exit(1)

    topic = sys.argv[1]
    tag = sys.argv[2]
    
    try:
        google_articles = fetch_google_news(topic)
        medium_articles = fetch_medium(tag)
        all_articles = google_articles + medium_articles
        update_readme(all_articles)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)