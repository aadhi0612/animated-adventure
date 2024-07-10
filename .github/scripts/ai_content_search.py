# .github/scripts/ai_content_search.py
import sys
import requests
from bs4 import BeautifulSoup

def fetch_google_news(topic):
    print(f"Fetching news for topic: {topic}")
    url = f'https://news.google.com/search?q={topic}&hl=en-US&gl=US&ceid=US:en'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for item in soup.find_all('h3', limit=5):  # Limit to top 5 articles
        article_link = item.find('a', href=True)
        if article_link:
            article = {
                'title': item.text,
                'link': 'https://news.google.com' + article_link['href'][1:],
                'source': 'Google News'  # Additional detail can be scraped here if available
            }
            articles.append(article)
    return articles

def fetch_medium(tag):
    print(f"Fetching Medium articles for tag: {tag}")
    url = f'https://medium.com/tag/{tag}/latest'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for item in soup.find_all('h3', limit=5):  # Limit to top 5 articles
        link = item.find_parent('a', href=True)
        if link:
            article = {
                'title': item.get_text(strip=True),
                'link': f'https://medium.com{link["href"]}',
                'source': 'Medium'  # This ensures we know the source right in the script
            }
            articles.append(article)
        else:
            print("Link not found for Medium article")
    return articles

def update_readme(google_articles, medium_articles):
    print("Updating README with new content")
    try:
        with open('README.md', 'r+') as file:
            content = file.read()
            google_start = content.find('<!-- GOOGLE-NEWS-CONTENT:START -->') + 34
            google_end = content.find('<!-- GOOGLE-NEWS-CONTENT:END -->')
            medium_start = content.find('<!-- MEDIUM-CONTENT:START -->') + 29
            medium_end = content.find('<!-- MEDIUM-CONTENT:END -->')
            
            # Format the articles for markdown
            google_formatted = '\n'.join(f'- [{article["title"]}]({article["link"]})' for article in google_articles)
            medium_formatted = '\n'.join(f'- [{article["title"]}]({article["link"]})' for article in medium_articles)
            
            # Update the content in the README
            updated_content = (content[:google_start] + google_formatted + content[google_end:medium_start] 
                               + medium_formatted + content[medium_end:])
            file.seek(0)
            file.write(updated_content)
            file.truncate()
            print("README updated successfully")
    except Exception as e:
        print(f"Failed to update README: {str(e)}")

if __name__ == "__main__":
    topic = sys.argv[1]
    tag = sys.argv[2]
    google_articles = fetch_google_news(topic)
    medium_articles = fetch_medium(tag)
    update_readme(google_articles, medium_articles)
