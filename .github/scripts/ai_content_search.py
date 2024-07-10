# .github/scripts/ai_content_search.py
import sys
import requests
from bs4 import BeautifulSoup
import feedparser
from datetime import datetime

def fetch_google_news_rss(topic):
    topic = topic.replace(' ', '+')
    print(f"Fetching news via RSS for topic: {topic}")
    url = f'https://news.google.com/rss/search?q={topic}&hl=en-US&gl=US&ceid=US:en'
    feed = feedparser.parse(url)
    articles = []
    for entry in feed.entries[:10]:  # Limit to top 10 articles for better quality
        published = datetime.strptime(entry.published, '%a, %d %b %Y %H:%M:%S %Z')
        article = {
            'title': entry.title,
            'link': entry.link,
            'source': 'Google News',
            'published': published.strftime('%B %d, %Y'),
            'summary': entry.summary,
            'image_url': 'https://via.placeholder.com/150'  # Placeholder image
        }
        articles.append(article)
    return articles

def fetch_medium(tag): 
    tag = tag.replace(' ', '-')
    print(f"Fetching Medium articles for tag: {tag}")
    url = f'https://medium.com/tag/{tag}/latest'
    response = requests.get(url)
    soup = BeautifulSoup(response.text, 'html.parser')
    articles = []
    for article in soup.select('.postArticle', limit=10):  # Adjust the selector based on actual page structure
        title_tag = article.find('h3')
        link_tag = article.find('a', href=True)
        summary_tag = article.find('h4')
        image_tag = article.find('img')
        if title_tag and link_tag:
            title = title_tag.get_text(strip=True)
            link = link_tag['href']
            summary = summary_tag.get_text(strip=True) if summary_tag else 'No summary available'
            image_url = image_tag['src'] if image_tag else 'https://via.placeholder.com/150'
            articles.append({
                'title': title,
                'link': f'https://medium.com{link}',
                'source': 'Medium',
                'summary': summary,
                'image_url': image_url
            })
    return articles

def format_article(article):
    return f'''
    <div style="margin-bottom: 20px;">
        <a href="{article['link']}" style="text-decoration: none; color: inherit;">
            <img src="{article['image_url']}" alt="{article['title']}" style="width: 150px; height: 150px; float: left; margin-right: 20px;">
            <div style="overflow: hidden;">
                <h3>{article['title']}</h3>
                <p><small>{article['source']} - Published on {article.get('published', '')}</small></p>
                <p>{article['summary']}</p>
            </div>
        </a>
        <div style="clear: both;"></div>
    </div>
    '''

def update_readme(google_articles, medium_articles):
    print("Updating README with new content")
    try:
        with open('README.md', 'r+') as file:
            content = file.read()
            google_start = content.find('<!-- GOOGLE-NEWS-CONTENT:START -->') + 34
            google_end = content.find('<!-- GOOGLE-NEWS-CONTENT:END -->')
            medium_start = content.find('<!-- MEDIUM-CONTENT:START -->') + 29
            medium_end = content.find('<!-- MEDIUM-CONTENT:END -->')
            
            # Format the articles with HTML
            google_formatted = ''.join(format_article(article) for article in google_articles)
            medium_formatted = ''.join(format_article(article) for article in medium_articles)
            spacer = "\n \n"
            # Update the content in the README
            updated_content = (content[:google_start] + spacer + google_formatted + content[google_end:medium_start] + spacer + medium_formatted + content[medium_end:])
            file.seek(0)
            file.write(updated_content)
            file.truncate()
            print("README updated successfully")
    except Exception as e:
        print(f"Failed to update README: {str(e)}")

if __name__ == "__main__":
    topic = sys.argv[1]
    tag = sys.argv[2]
    google_articles = fetch_google_news_rss(topic)
    medium_articles = fetch_medium(tag)
    update_readme(google_articles, medium_articles)
