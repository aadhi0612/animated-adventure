# .github/scripts/ai_content_search.py
import sys
import requests
from bs4 import BeautifulSoup

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
    with open('README.md', 'r+') as file:
        content = file.read()
        start = content.find('<!-- AI-CONTENT-LIST:START -->') + 30
        end = content.find('<!-- AI-CONTENT-LIST:END -->')
        article_list = '\n'.join(f'- [{article["title"]}]({article["link"]})' for article in articles)
        updated_content = content[:start] + article_list + content[end:]
        file.seek(0)
        file.write(updated_content)
        file.truncate()

if __name__ == "__main__":
    topic = sys.argv[1]
    tag = sys.argv[2]
    google_articles = fetch_google_news(topic)
    medium_articles = fetch_medium(tag)
    all_articles = google_articles + medium_articles
    update_readme(all_articles)
