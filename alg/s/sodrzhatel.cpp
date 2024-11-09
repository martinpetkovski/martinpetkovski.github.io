#include <iostream>
using namespace std;
 
int main()
{
    int m, n;
 
    cin >> m >> n;
    int prod = m * n;
 
    while (m != n)
    {
        if (m > n)
        {
            m -= n;
        }
        else
        {
            n -= m;
        }
    }
 
    cout << prod / m;
 
    return 0;
}