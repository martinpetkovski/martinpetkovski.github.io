#include <iostream>
using namespace std;
 
int main()
{
    int px, py, a, b;
    cin >> px >> py >> a >> b;
 
    int tx, ty;
    cin >> tx >> ty;
 
    if ((tx < px) || (tx > px+a) || (ty < py) || (ty > py+b))
    {
        cout << "nadvor" << endl;
    } else
    {
        //dali e na strana?
        if ((tx == px) || (tx == px+a) || (ty == py) || (ty == py+b))
        {
            cout << "strana" << endl;
        } else
        {
            cout << "vnatre" << endl;
        }
    }
 
    return 0;
}